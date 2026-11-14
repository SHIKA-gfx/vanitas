-- 기간 저장·삭제 함수 (docs/006 6-3, ④-2)
--
-- 적용: Supabase 대시보드 → SQL Editor에 이 파일을 통째로 붙여 넣고 한 번 실행한다.
--
-- 관리자 화면이 기간 하나를 통째로, 한 트랜잭션으로 저장한다 — 기간·예전 id·배너·배너 학생·픽업 외·출처를 한 번에 맞추고,
-- 바라면 일정 확인일(schedule.json meta.recruitsVerifiedAt)과 배포 요청까지 같은 저장에 넣는다.
-- 중간에 하나라도 실패하면 아무것도 바뀌지 않는다.
--
-- security invoker: 부른 사람(관리자)의 권한으로 돈다 → 표의 보안 규칙이 그대로 걸린다. 관리자 확인은 첫 줄에서 한 번 더 한다
-- (보안 규칙만 두면 비관리자의 수정·삭제는 오류 없이 0행으로 끝나 무엇이 막혔는지 알기 어렵다).
--
-- 바뀌지 않은 행은 다시 쓰지 않는다 (지우고 다시 넣지 않고 자리(seq)별로 맞춘다) → 변경 기록에 실제로 바뀐 행만 남는다.

begin;

-- ============================================================ 기간 저장

-- p_original_id  고치는 기간의 지금 id. 새 기간이면 null
-- p_recruit      기간 하나 — schedule.json recruits[]와 같은 모양
--                {id, start, end, status, event?, freePulls?, previousIds?, banners[{type, students[]}], offPickup?, sources[], note?}
-- p_verified_at  주면 일정 확인일을 이 날짜로 (플래너의 "일정 확인일")
-- p_deploy       true면 같은 저장에서 배포 요청 한 행 (docs/006 6-4)
-- 돌려주는 값    저장된 기간 id
--
-- id가 바뀌면 (시작일·이름을 고치면): ① 새 id가 이 기간의 예전 id에 있으면 그 줄을 빼고 (예전 날짜로 되돌리기)
-- ② id를 바꾸고 (배너·학생·출처·예전 id가 on update cascade로 따라간다) ③ 원래 id를 예전 id 끝에 더한다.
-- 저장된 목표·공유 링크는 예전 id로 이어진다 (resolveRecruitId, docs/005 10-2)
create function public.save_recruit(
  p_original_id text,
  p_recruit jsonb,
  p_verified_at date default null,
  p_deploy boolean default true
) returns text
  language plpgsql security invoker set search_path = ''
as $$
declare
  new_id  text := p_recruit ->> 'id';
  bad     text;
  prev    text[];
  banners jsonb := coalesce(p_recruit -> 'banners', '[]');
  offs    jsonb := coalesce(p_recruit -> 'offPickup', '[]');
  srcs    jsonb := coalesce(p_recruit -> 'sources', '[]');
begin
  if not (select public.is_admin()) then
    raise exception '관리자만 저장할 수 있다' using errcode = '42501';
  end if;
  if new_id is null or new_id = '' then
    raise exception '기간 id가 없다' using errcode = '22023';
  end if;

  -- 표에 없는 칸이 있으면 멈춘다 (조용히 버리지 않는다 — 변환 convert.ts와 같은 규칙)
  select string_agg(k, ', ') into bad from jsonb_object_keys(p_recruit) k
   where k not in ('id', 'start', 'end', 'status', 'event', 'freePulls', 'previousIds',
                   'banners', 'offPickup', 'sources', 'note');
  if bad is not null then
    raise exception '표에 없는 칸: %', bad using errcode = '22023';
  end if;
  if jsonb_typeof(banners) <> 'array' or jsonb_array_length(banners) = 0 then
    raise exception '배너가 없다' using errcode = '22023';
  end if;
  select string_agg(distinct k, ', ') into bad
    from jsonb_array_elements(banners) b, jsonb_object_keys(b) k
   where k not in ('type', 'students');
  if bad is not null then
    raise exception '배너에 표에 없는 칸: %', bad using errcode = '22023';
  end if;

  -- 기간 행
  if p_original_id is null then
    insert into public.recruits (id, start_date, end_date, status, event, free_pulls, note)
    values (new_id, (p_recruit ->> 'start')::date, (p_recruit ->> 'end')::date, p_recruit ->> 'status',
            nullif(btrim(p_recruit ->> 'event'), ''), (p_recruit ->> 'freePulls')::integer,
            nullif(btrim(p_recruit ->> 'note'), ''));
  else
    perform 1 from public.recruits where id = p_original_id for update;
    if not found then
      raise exception '없는 기간: %', p_original_id using errcode = 'P0002';
    end if;
    if new_id <> p_original_id then
      delete from public.recruit_previous_ids where recruit_id = p_original_id and old_id = new_id;
      update public.recruits set id = new_id where id = p_original_id;
    end if;
    update public.recruits
       set start_date = (p_recruit ->> 'start')::date,
           end_date   = (p_recruit ->> 'end')::date,
           status     = p_recruit ->> 'status',
           event      = nullif(btrim(p_recruit ->> 'event'), ''),
           free_pulls = (p_recruit ->> 'freePulls')::integer,
           note       = nullif(btrim(p_recruit ->> 'note'), '')
     where id = new_id;
  end if;

  -- 예전 id: 받은 목록에서 지금 id를 빼고, id가 바뀌었으면 원래 id를 끝에 더한다
  select coalesce(array_agg(x order by o), '{}') into prev
    from jsonb_array_elements_text(coalesce(p_recruit -> 'previousIds', '[]')) with ordinality t(x, o)
   where x <> new_id;
  if p_original_id is not null and p_original_id <> new_id and not (p_original_id = any (prev)) then
    prev := prev || p_original_id;
  end if;
  delete from public.recruit_previous_ids where recruit_id = new_id and seq > cardinality(prev);
  insert into public.recruit_previous_ids (recruit_id, seq, old_id)
  select new_id, o, x from unnest(prev) with ordinality t(x, o)
  on conflict (recruit_id, seq) do update set old_id = excluded.old_id;

  -- 배너 (배너를 줄이면 그 배너의 학생도 함께 지워진다 — on delete cascade)
  delete from public.recruit_banners where recruit_id = new_id and seq > jsonb_array_length(banners);
  insert into public.recruit_banners (recruit_id, seq, type)
  select new_id, o, b ->> 'type' from jsonb_array_elements(banners) with ordinality t(b, o)
  on conflict (recruit_id, seq) do update set type = excluded.type;

  -- 배너 학생
  delete from public.banner_students s
   where s.recruit_id = new_id
     and not exists (
       select 1
         from jsonb_array_elements(banners) with ordinality t(b, o),
              jsonb_array_elements_text(coalesce(b -> 'students', '[]')) with ordinality u(sid, so)
        where o = s.banner_seq and so = s.seq);
  insert into public.banner_students (recruit_id, banner_seq, seq, student_id)
  select new_id, o, so, sid
    from jsonb_array_elements(banners) with ordinality t(b, o),
         jsonb_array_elements_text(coalesce(b -> 'students', '[]')) with ordinality u(sid, so)
  on conflict (recruit_id, banner_seq, seq) do update set student_id = excluded.student_id;

  -- 픽업 외 학생
  delete from public.recruit_off_pickup where recruit_id = new_id and seq > jsonb_array_length(offs);
  insert into public.recruit_off_pickup (recruit_id, seq, student_id)
  select new_id, o, x from jsonb_array_elements_text(offs) with ordinality t(x, o)
  on conflict (recruit_id, seq) do update set student_id = excluded.student_id;

  -- 출처
  delete from public.recruit_sources where recruit_id = new_id and seq > jsonb_array_length(srcs);
  insert into public.recruit_sources (recruit_id, seq, source_id)
  select new_id, o, x from jsonb_array_elements_text(srcs) with ordinality t(x, o)
  on conflict (recruit_id, seq) do update set source_id = excluded.source_id;

  -- 일정 확인일. 문서 열은 json(키 순서를 지킨다)이라 jsonb 함수로 고치지 않고 그 값 하나만 글자로 바꾼다
  if p_verified_at is not null then
    update public.datasets
       set data = regexp_replace(data::text, '("recruitsVerifiedAt"\s*:\s*)"[^"]*"',
                                 '\1"' || to_char(p_verified_at, 'YYYY-MM-DD') || '"')::json
     where path = 'ko/schedule.json';
  end if;

  if p_deploy then
    insert into public.deploy_requests (reason) values (left('기간 저장: ' || new_id, 200));
  end if;
  return new_id;
end
$$;

-- ============================================================ 기간 삭제

-- 배너·학생·출처·예전 id는 on delete cascade로 함께 지워진다.
-- 그 기간을 고른 저장된 목표는 플래너가 읽을 때 빠진다 (normalizeTargetKeys)
create function public.delete_recruit(p_id text, p_deploy boolean default true) returns void
  language plpgsql security invoker set search_path = ''
as $$
begin
  if not (select public.is_admin()) then
    raise exception '관리자만 지울 수 있다' using errcode = '42501';
  end if;
  delete from public.recruits where id = p_id;
  if not found then
    raise exception '없는 기간: %', p_id using errcode = 'P0002';
  end if;
  if p_deploy then
    insert into public.deploy_requests (reason) values (left('기간 삭제: ' || p_id, 200));
  end if;
end
$$;

-- 새 함수는 기본으로 누구나(public) 부를 수 있다 → 거두고 로그인한 사람에게만. 안에서 관리자인지 다시 본다
revoke execute on function public.save_recruit(text, jsonb, date, boolean) from public, anon, service_role;
revoke execute on function public.delete_recruit(text, boolean) from public, anon, service_role;
grant execute on function public.save_recruit(text, jsonb, date, boolean) to authenticated;
grant execute on function public.delete_recruit(text, boolean) to authenticated;

commit;
