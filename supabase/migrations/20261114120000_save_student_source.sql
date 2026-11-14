-- 학생·출처 저장 함수 (docs/006 6-3, ④-3)
--
-- 적용: Supabase 대시보드 → SQL Editor에 이 파일을 통째로 붙여 넣고 한 번 실행한다.
--
-- 기간 저장(20261114000000_save_recruit.sql)과 같은 방식: security invoker + 관리자 확인, 한 트랜잭션, 배포 요청도 같은 저장.
-- 받는 모양은 데이터 파일과 같다 — 학생은 students.json students[], 출처는 sources.json sources의 한 건 (id는 따로).
--
-- 학생 id는 저장값·공유 링크(목표 이름 "기간 id~학생 id")가 쓰므로 만든 뒤 바꾸지 않는다.
-- 출처 id는 다음 번호를 DB가 정한다. 출처는 지우지 않는다 — 예전 값의 근거로 남긴다 (지울 일이 생기면 SQL Editor로).

begin;

-- ============================================================ 학생

-- p_original_id  고치는 학생의 id. 새 학생이면 null
-- p_student      {id, gameId, name: {ko, ja}, koNameStatus}
create function public.save_student(
  p_original_id text,
  p_student jsonb,
  p_deploy boolean default true
) returns text
  language plpgsql security invoker set search_path = ''
as $$
declare
  sid  text := p_student ->> 'id';
  name jsonb := coalesce(p_student -> 'name', '{}');
  bad  text;
begin
  if not (select public.is_admin()) then
    raise exception '관리자만 저장할 수 있다' using errcode = '42501';
  end if;
  select string_agg(k, ', ') into bad from jsonb_object_keys(p_student) k
   where k not in ('id', 'gameId', 'name', 'koNameStatus');
  if bad is null then
    select string_agg(k, ', ') into bad from jsonb_object_keys(name) k where k not in ('ko', 'ja');
  end if;
  if bad is not null then
    raise exception '표에 없는 칸: %', bad using errcode = '22023';
  end if;

  if p_original_id is null then
    -- 파일 순서(seq)는 맨 뒤. 동시에 두 명을 더해도 겹치지 않게 잠근다
    lock table public.students in share row exclusive mode;
    insert into public.students (id, game_id, name_ko, name_ja, ko_name_status, seq)
    select sid, (p_student ->> 'gameId')::integer, btrim(name ->> 'ko'), nullif(btrim(name ->> 'ja'), ''),
           p_student ->> 'koNameStatus', coalesce(max(seq), 0) + 1
      from public.students;
  else
    if sid is distinct from p_original_id then
      raise exception '학생 id는 바꾸지 않는다 (저장된 목표·공유 링크가 쓴다)' using errcode = '22023';
    end if;
    update public.students
       set game_id        = (p_student ->> 'gameId')::integer,
           name_ko        = btrim(name ->> 'ko'),
           name_ja        = nullif(btrim(name ->> 'ja'), ''),
           ko_name_status = p_student ->> 'koNameStatus'
     where id = p_original_id;
    if not found then
      raise exception '없는 학생: %', p_original_id using errcode = 'P0002';
    end if;
  end if;

  if p_deploy then
    insert into public.deploy_requests (reason) values (left('학생 저장: ' || sid, 200));
  end if;
  return sid;
end
$$;

-- 픽업·픽업 외에 쓰이는 학생은 지울 수 없다 (참조 제약이 막는다 — 오류 23503)
create function public.delete_student(p_id text, p_deploy boolean default true) returns void
  language plpgsql security invoker set search_path = ''
as $$
begin
  if not (select public.is_admin()) then
    raise exception '관리자만 지울 수 있다' using errcode = '42501';
  end if;
  delete from public.students where id = p_id;
  if not found then
    raise exception '없는 학생: %', p_id using errcode = 'P0002';
  end if;
  if p_deploy then
    insert into public.deploy_requests (reason) values (left('학생 삭제: ' || p_id, 200));
  end if;
end
$$;

-- ============================================================ 출처

-- p_id      고치는 출처의 id. 새 출처면 null — 다음 번호를 정해 돌려준다
-- p_source  {publisher, title, date, url, retrievedAt?, tier, note?}  (sources.json의 한 건)
create function public.save_source(
  p_id text,
  p_source jsonb,
  p_deploy boolean default true
) returns text
  language plpgsql security invoker set search_path = ''
as $$
declare
  sid text := p_id;
  bad text;
begin
  if not (select public.is_admin()) then
    raise exception '관리자만 저장할 수 있다' using errcode = '42501';
  end if;
  select string_agg(k, ', ') into bad from jsonb_object_keys(p_source) k
   where k not in ('publisher', 'title', 'date', 'url', 'retrievedAt', 'tier', 'note');
  if bad is not null then
    raise exception '표에 없는 칸: %', bad using errcode = '22023';
  end if;

  if sid is null then
    lock table public.sources in share row exclusive mode;
    select (coalesce(max(id::integer), 0) + 1)::text into sid from public.sources;
    insert into public.sources (id, publisher, title, published, url, retrieved_at, tier, note)
    values (sid, btrim(p_source ->> 'publisher'), btrim(p_source ->> 'title'),
            nullif(btrim(p_source ->> 'date'), ''), nullif(btrim(p_source ->> 'url'), ''),
            nullif(btrim(p_source ->> 'retrievedAt'), '')::date, p_source ->> 'tier',
            nullif(btrim(p_source ->> 'note'), ''));
  else
    update public.sources
       set publisher    = btrim(p_source ->> 'publisher'),
           title        = btrim(p_source ->> 'title'),
           published    = nullif(btrim(p_source ->> 'date'), ''),
           url          = nullif(btrim(p_source ->> 'url'), ''),
           retrieved_at = nullif(btrim(p_source ->> 'retrievedAt'), '')::date,
           tier         = p_source ->> 'tier',
           note         = nullif(btrim(p_source ->> 'note'), '')
     where id = sid;
    if not found then
      raise exception '없는 출처: %', sid using errcode = 'P0002';
    end if;
  end if;

  if p_deploy then
    insert into public.deploy_requests (reason) values (left('출처 저장: ' || sid, 200));
  end if;
  return sid;
end
$$;

-- 새 함수는 기본으로 누구나(public) 부를 수 있다 → 거두고 로그인한 사람에게만. 안에서 관리자인지 다시 본다
revoke execute on function public.save_student(text, jsonb, boolean) from public, anon, service_role;
revoke execute on function public.delete_student(text, boolean) from public, anon, service_role;
revoke execute on function public.save_source(text, jsonb, boolean) from public, anon, service_role;
grant execute on function public.save_student(text, jsonb, boolean) to authenticated;
grant execute on function public.delete_student(text, boolean) to authenticated;
grant execute on function public.save_source(text, jsonb, boolean) to authenticated;

commit;
