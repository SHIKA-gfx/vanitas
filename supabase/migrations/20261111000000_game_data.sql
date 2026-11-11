-- VANITAS 게임 데이터 — 테이블·보안 규칙 (설계: docs/006-db-migration.md)
--
-- 적용: Supabase 대시보드 → SQL Editor에 이 파일을 통째로 붙여 넣고 한 번 실행한다.
-- 이 파일에는 비밀값이 없다. 배포 훅 주소는 레포·이 파일에 쓰지 않는다 (docs/006 6장).
--
-- 보안 규칙 요약 (docs/006 5장)
--   게임 데이터 표 9개: 읽기는 누구나(anon·authenticated), 추가·수정·삭제는 관리자만
--   admins: 클라이언트 역할에는 권한 없음 — 관리자 추가·삭제는 SQL 편집기에서만
--   change_log: 관리자만 읽기, 쓰기는 트리거만
--   service_role(비밀 키)에는 표 권한을 주지 않는다 — 이 프로젝트는 비밀 키를 쓰지 않는다
--
-- 2026-05-30 이후 새 Supabase 프로젝트는 public 스키마의 표를 Data API에 자동으로 열지 않는다.
-- 그래서 권한을 모두 명시적으로 준다 (예전 설정의 프로젝트에서도 같은 결과가 되도록 먼저 회수한다).

begin;

-- ============================================================ 1. 관리자

create table public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  note       text,
  created_at timestamptz not null default now()
);
comment on table public.admins is '관리자 목록. 추가: insert into public.admins (user_id) values (''<Authentication의 User UID>'')';

alter table public.admins enable row level security;
revoke all on table public.admins from anon, authenticated, service_role;

-- 지금 로그인한 사람이 관리자인가. 보안 규칙과 관리자 화면이 쓴다.
-- security definer: admins 표는 클라이언트가 읽을 수 없으므로 함수 주인(postgres) 권한으로 읽는다.
create function public.is_admin() returns boolean
  language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()))
$$;
revoke execute on function public.is_admin() from public, anon, service_role;
grant execute on function public.is_admin() to authenticated;

-- ============================================================ 2. 공통 트리거

create function public.touch_updated_at() returns trigger
  language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;
revoke execute on function public.touch_updated_at() from public, anon, authenticated, service_role;

-- 변경 기록. 누가(actor) 언제 어느 행을 어떻게 바꿨나. 한 번의 저장은 같은 tx로 묶인다.
create table public.change_log (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  tx         xid8 not null default pg_current_xact_id(),
  actor      uuid,            -- auth.uid(). SQL 편집기에서 바꾸면 null
  table_name text not null,
  op         text not null check (op in ('INSERT', 'UPDATE', 'DELETE')),
  row_key    text not null,
  old_row    jsonb,
  new_row    jsonb
);
comment on table public.change_log is '게임 데이터 변경 기록 (트리거가 쓴다). 관리자만 읽는다';
create index change_log_at_idx on public.change_log (at desc);

-- 트리거 인자: 행 이름(기본 키) 열들. 여러 열이면 ':'로 잇는다. 예) log_change('recruit_id', 'seq') → '2026-11-10-…:2'
-- security definer: change_log에는 클라이언트 쓰기 권한이 없다.
create function public.log_change() returns trigger
  language plpgsql security definer set search_path = ''
as $$
declare
  r      jsonb := to_jsonb(coalesce(new, old));
  o      jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  n      jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  rowkey text;
begin
  -- 값이 그대로인 수정(다시 저장)은 남기지 않는다. updated_at만 바뀐 것도 같다
  if tg_op = 'UPDATE' and (o - 'updated_at') = (n - 'updated_at') then
    return null;
  end if;
  select string_agg(r ->> a, ':' order by i) into rowkey
    from unnest(tg_argv) with ordinality as k(a, i);
  insert into public.change_log (actor, table_name, op, row_key, old_row, new_row)
    values ((select auth.uid()), tg_table_name, tg_op, rowkey, o, n);
  return null;
end
$$;
revoke execute on function public.log_change() from public, anon, authenticated, service_role;

-- ============================================================ 3. 게임 데이터 — 정식 표

-- 출처 (data/sources.json의 sources). id는 지금처럼 숫자 문자열 — 데이터 파일들이 이 문자열로 가리킨다
create table public.sources (
  id           text primary key check (id ~ '^[1-9][0-9]*$'),
  publisher    text not null check (publisher <> ''),
  title        text not null check (title <> ''),
  published    text check (published ~ '^[0-9]{4}(-[0-9]{2}(-[0-9]{2})?)?$'), -- JSON date. 연도·연월만 있는 출처가 있어 date 형이 아니다
  url          text check (url ~ '^https?://'),
  retrieved_at date,
  tier         text not null check (tier in ('official', 'press', 'community')),
  note         text,
  updated_at   timestamptz not null default now()
);
comment on table public.sources is '출처 목록 (data/sources.json). 공지된 기간에는 tier official 출처가 있어야 한다 (validate.py)';

-- 학생 (data/ko/students.json의 students). 미래시에 나오는 학생만 — 전체 도감이 아니다
-- id는 저장값·공유 링크(목표 이름 "기간 id~학생 id")가 쓴다. 만든 뒤 바꾸지 않는다
create table public.students (
  id             text primary key check (id ~ '^[a-z][a-z0-9_]*$'),
  game_id        integer not null unique check (game_id > 0),
  name_ko        text not null check (name_ko <> ''),
  name_ja        text,
  ko_name_status text not null check (ko_name_status in ('official', 'provisional')),
  seq            integer not null, -- 파일에 쓰는 순서
  updated_at     timestamptz not null default now()
);
comment on table public.students is '플래너가 고를 수 있는 학생 (data/ko/students.json). provisional = 가칭';

-- 픽업 기간 (data/ko/schedule.json의 recruits). 모집 스택 전환(2026-11-10) 뒤 기간만 — validate.py가 검사
-- id는 시작일로 시작한다. 날짜가 바뀌면 id도 바뀌고, 예전 id는 recruit_previous_ids에 남겨
-- 저장된 목표·공유 링크를 잇는다 (docs/005 10-2). 아래 표들은 id 변경을 따라간다 (on update cascade)
create table public.recruits (
  id         text primary key check (id ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z0-9]+(-[a-z0-9]+)*$'),
  start_date date not null,
  end_date   date not null,
  status     text not null check (status in ('announced', 'estimated')),
  event      text,
  free_pulls integer check (free_pulls > 0),
  note       text,
  updated_at timestamptz not null default now(),
  check (end_date > start_date)
);
comment on table public.recruits is '픽업 기간 (schedule.json recruits). 파일 순서는 start_date, id. 예전 id는 recruit_previous_ids';
create index recruits_start_idx on public.recruits (start_date, id);

-- 기간의 예전 id (recruits[].previousIds). 저장된 목표·공유 링크의 예전 id를 지금 id로 잇는다 (resolveRecruitId)
-- validate.py의 previousIds 검사 네 가지를 DB가 막는다:
--   형식 'YYYY-MM-DD-이름' → check / 자기 id 아님 → check / 두 기간이 같은 예전 id → unique /
--   지금 있는 기간 id와 겹침 → 아래 제약 트리거 (트랜잭션 끝에 검사 — id를 바꾸며 예전 id를 더하는 저장을 한 번에)
create table public.recruit_previous_ids (
  recruit_id text not null references public.recruits (id) on update cascade on delete cascade,
  seq        smallint not null check (seq >= 1),
  old_id     text not null check (old_id ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z0-9]+(-[a-z0-9]+)*$'),
  primary key (recruit_id, seq),
  unique (old_id) deferrable initially deferred,
  check (old_id <> recruit_id)
);
comment on table public.recruit_previous_ids is '기간의 예전 id (recruits[].previousIds). 지금 있는 기간 id와 겹칠 수 없다';

-- 기간의 배너. seq는 화면·파일 순서 (1부터)
create table public.recruit_banners (
  recruit_id text not null references public.recruits (id) on update cascade on delete cascade,
  seq        smallint not null check (seq >= 1),
  type       text not null check (type ~ '^[a-z][a-z0-9_]*$'), -- banner-types.json의 id. 문서형 데이터라 참조 제약 대신 validate.py가 검사
  primary key (recruit_id, seq)
);
comment on table public.recruit_banners is '기간의 배너 (recruits[].banners). type은 banner-types id';

-- 배너의 픽업 학생
create table public.banner_students (
  recruit_id text not null,
  banner_seq smallint not null,
  seq        smallint not null check (seq >= 1),
  student_id text not null references public.students (id),
  primary key (recruit_id, banner_seq, seq),
  foreign key (recruit_id, banner_seq)
    references public.recruit_banners (recruit_id, seq) on update cascade on delete cascade
);
comment on table public.banner_students is '배너의 픽업 학생 (banners[].students)';
create index banner_students_student_idx on public.banner_students (student_id);

-- 픽업 외 모집 가능 학생 (페스 등, 목표로는 고를 수 없음)
create table public.recruit_off_pickup (
  recruit_id text not null references public.recruits (id) on update cascade on delete cascade,
  seq        smallint not null check (seq >= 1),
  student_id text not null references public.students (id),
  primary key (recruit_id, seq),
  unique (recruit_id, student_id) deferrable initially deferred
);
comment on table public.recruit_off_pickup is '픽업 외 모집 가능 학생 (recruits[].offPickup)';
create index recruit_off_pickup_student_idx on public.recruit_off_pickup (student_id);

-- 기간의 출처
create table public.recruit_sources (
  recruit_id text not null references public.recruits (id) on update cascade on delete cascade,
  seq        smallint not null check (seq >= 1),
  source_id  text not null references public.sources (id),
  primary key (recruit_id, seq),
  unique (recruit_id, source_id) deferrable initially deferred
);
comment on table public.recruit_sources is '기간의 출처 (recruits[].sources)';
create index recruit_sources_source_idx on public.recruit_sources (source_id);

-- 예전 id가 지금 있는 기간 id와 겹치지 않게 (두 표에 걸친 규칙이라 check로는 안 된다).
-- deferrable initially deferred: 트랜잭션이 끝날 때 한 번 본다 — 저장 중간 순서와 관계없다
create function public.check_previous_id_clash() returns trigger
  language plpgsql set search_path = ''
as $$
begin
  if tg_table_name = 'recruits' then
    if exists (select 1 from public.recruit_previous_ids p where p.old_id = new.id) then
      raise exception '기간 id %가 다른 기간의 예전 id와 같다', new.id using errcode = '23505';
    end if;
  elsif exists (select 1 from public.recruits r where r.id = new.old_id) then
    raise exception '예전 id %가 지금 있는 기간 id와 같다', new.old_id using errcode = '23505';
  end if;
  return null;
end
$$;
revoke execute on function public.check_previous_id_clash() from public, anon, authenticated, service_role;

create constraint trigger previous_id_clash after insert or update of id on public.recruits
  deferrable initially deferred for each row execute function public.check_previous_id_clash();
create constraint trigger previous_id_clash after insert or update of old_id on public.recruit_previous_ids
  deferrable initially deferred for each row execute function public.check_previous_id_clash();

-- ============================================================ 4. 게임 데이터 — 문서형 (파일 하나 = 행 하나)

-- data는 jsonb가 아니라 json: 키 순서와 쓴 그대로를 지킨다 (jsonb는 키를 다시 정렬한다, docs/006 결정 E).
-- 그래서 DB 안에서 jsonb 함수로 고치지 않는다 — 고칠 때는 화면·스크립트에서 통째로 바꿔 넣는다.
-- 정식 표로 뺀 배열 자리에는 {"$table": "<표>"} 표시를 둔다. 내보내기가 그 자리에 표 내용을 채운다.
create table public.datasets (
  path       text primary key check (path ~ '^(sources\.json|(shared|ko|ja)/[a-z0-9-]+\.json)$'),
  data       json not null check (json_typeof(data) = 'object'),
  updated_at timestamptz not null default now(),
  -- 표로 뺀 배열 자리에 표시가 있어야 한다 (null이면 통과해 버리므로 is not distinct from)
  check (
    case path
      when 'ko/schedule.json' then (data -> 'recruits' ->> '$table') is not distinct from 'recruits'
      when 'ko/students.json' then (data -> 'students' ->> '$table') is not distinct from 'students'
      when 'sources.json' then (data -> 'sources' ->> '$table') is not distinct from 'sources'
      else true
    end
  )
);
comment on table public.datasets is 'data/ 아래 JSON 파일. 표로 뺀 배열 자리는 {"$table": ...} (docs/006 4장)';

-- ============================================================ 5. 트리거

create trigger touch before update on public.sources  for each row execute function public.touch_updated_at();
create trigger touch before update on public.students for each row execute function public.touch_updated_at();
create trigger touch before update on public.recruits for each row execute function public.touch_updated_at();
create trigger touch before update on public.datasets for each row execute function public.touch_updated_at();

create trigger log after insert or update or delete on public.sources
  for each row execute function public.log_change('id');
create trigger log after insert or update or delete on public.students
  for each row execute function public.log_change('id');
create trigger log after insert or update or delete on public.recruits
  for each row execute function public.log_change('id');
create trigger log after insert or update or delete on public.recruit_previous_ids
  for each row execute function public.log_change('recruit_id', 'seq');
create trigger log after insert or update or delete on public.recruit_banners
  for each row execute function public.log_change('recruit_id', 'seq');
create trigger log after insert or update or delete on public.banner_students
  for each row execute function public.log_change('recruit_id', 'banner_seq', 'seq');
create trigger log after insert or update or delete on public.recruit_off_pickup
  for each row execute function public.log_change('recruit_id', 'seq');
create trigger log after insert or update or delete on public.recruit_sources
  for each row execute function public.log_change('recruit_id', 'seq');
create trigger log after insert or update or delete on public.datasets
  for each row execute function public.log_change('path');

-- ============================================================ 6. 보안 규칙 (RLS)과 권한

-- 게임 데이터 표 9개는 같은 규칙: 읽기는 누구나, 추가·수정·삭제는 관리자만
do $$
declare
  t text;
begin
  foreach t in array array[
    'sources', 'students', 'recruits', 'recruit_previous_ids', 'recruit_banners', 'banner_students',
    'recruit_off_pickup', 'recruit_sources', 'datasets'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated, service_role', t);
    execute format('grant select on table public.%I to anon, authenticated', t);
    execute format('grant insert, update, delete on table public.%I to authenticated', t);

    execute format('create policy "읽기: 누구나" on public.%I for select to anon, authenticated using (true)', t);
    execute format('create policy "추가: 관리자" on public.%I for insert to authenticated with check ((select public.is_admin()))', t);
    execute format('create policy "수정: 관리자" on public.%I for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', t);
    execute format('create policy "삭제: 관리자" on public.%I for delete to authenticated using ((select public.is_admin()))', t);
  end loop;
end
$$;

-- 변경 기록: 관리자만 읽는다. 쓰기는 트리거(log_change)만
alter table public.change_log enable row level security;
revoke all on table public.change_log from anon, authenticated, service_role;
grant select on table public.change_log to authenticated;
create policy "읽기: 관리자" on public.change_log for select to authenticated using ((select public.is_admin()));

-- 저장 단위로 묶어 보기 (발표·관리자 화면용). security_invoker: 보는 사람의 권한으로 읽어 change_log의 규칙이 그대로 걸린다
create view public.change_log_saves with (security_invoker = true) as
  select tx,
         min(at)                                                    as at,
         (array_agg(actor))[1]                                      as actor,
         count(*)                                                   as rows,
         array_agg(distinct table_name order by table_name)        as tables,
         array_agg(distinct split_part(row_key, ':', 1) order by split_part(row_key, ':', 1)) as keys
    from public.change_log
   group by tx;
revoke all on table public.change_log_saves from anon, authenticated, service_role;
grant select on table public.change_log_saves to authenticated;

commit;
