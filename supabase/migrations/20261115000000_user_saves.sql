-- 사용자 저장값 (docs/007 3장, ⑥-1)
--
-- 적용: Supabase 대시보드 → SQL Editor에 이 파일을 통째로 붙여 넣고 한 번 실행한다.
-- 그다음 Authentication → Hooks → Before User Created에 public.hook_before_user_created를 고른다.
-- 가입 열기("Allow new users to sign up")는 ⑥-2를 배포할 때 한다 — 훅이 먼저 있어야 한다.
--
-- 로그인한 사람이 자기 저장 파일(vanitas:v1의 { version, sections })을 한 행에 둔다.
-- 게임 데이터 표의 쓰기 권한(is_admin)은 건드리지 않는다 — 누구나 로그인해도 게임 데이터는 관리자만 고친다.

begin;

-- ============================================================ 1. 표

create table public.user_saves (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default clock_timestamp(),
  constraint user_saves_data_object check (jsonb_typeof(data) = 'object'),
  constraint user_saves_data_size check (octet_length(data::text) <= 65536)
);
comment on table public.user_saves is '사용자 저장값 (docs/007). 행마다 브라우저 저장 파일 하나. 본인만 읽고 쓴다';

alter table public.user_saves enable row level security;
revoke all on table public.user_saves from anon, authenticated, service_role;
grant select, insert, update, delete on table public.user_saves to authenticated;

create policy "읽기: 본인" on public.user_saves for select to authenticated
  using (user_id = (select auth.uid()));
create policy "추가: 본인" on public.user_saves for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "수정: 본인" on public.user_saves for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "삭제: 본인" on public.user_saves for delete to authenticated
  using (user_id = (select auth.uid()));

-- ============================================================ 2. 저장

-- p_data      저장 파일 전체
-- p_expected  먼저 읽은 판 (updated_at). 처음 저장이면 null
-- 돌려주는 값 새 판
-- 판이 다르면(다른 기기에서 먼저 저장) P0001 — 화면이 "이 기기 값 / 계정 값"을 묻는다 (docs/007 4장).
-- 40001은 쓰지 않는다: Data API(PostgREST)가 그 코드는 다시 시도해 응답이 끝나지 않는다 (docs/006 6-3-3)
create function public.save_my_data(p_data jsonb, p_expected timestamptz)
returns timestamptz
  language plpgsql security invoker set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  ver timestamptz;
begin
  if uid is null then
    raise exception '로그인이 필요하다' using errcode = '42501';
  end if;
  if p_expected is null then
    insert into public.user_saves (user_id, data) values (uid, p_data)
    on conflict (user_id) do nothing
    returning updated_at into ver;
  else
    update public.user_saves set data = p_data, updated_at = clock_timestamp()
     where user_id = uid and updated_at = p_expected
    returning updated_at into ver;
  end if;
  if ver is null then
    raise exception '다른 기기에서 먼저 저장했다' using errcode = 'P0001';
  end if;
  return ver;
end
$$;

revoke execute on function public.save_my_data(jsonb, timestamptz) from public, anon, service_role;
grant execute on function public.save_my_data(jsonb, timestamptz) to authenticated;

-- ============================================================ 3. 계정 삭제

-- 자기 계정을 지운다. user_saves는 외래 키(on delete cascade)로 함께 지워진다.
-- security definer: auth.users를 지울 권한은 함수 주인(postgres)에게 있다. 지우는 대상은 auth.uid() 하나뿐이다.
-- 관리자 계정은 여기서 지우지 않는다 (실수로 관리자를 잃지 않게 — 지울 때는 대시보드에서)
create function public.delete_my_account()
returns void
  language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception '로그인이 필요하다' using errcode = '42501';
  end if;
  if exists (select 1 from public.admins where user_id = uid) then
    raise exception '관리자 계정은 여기서 지우지 않는다' using errcode = '42501';
  end if;
  delete from auth.users where id = uid;
end
$$;

revoke execute on function public.delete_my_account() from public, anon, service_role;
grant execute on function public.delete_my_account() to authenticated;

-- ============================================================ 4. 새 계정 거르기 (Auth 훅)

-- Authentication → Hooks → Before User Created. 구글·카카오가 아닌 새 계정은 거부한다 —
-- 가입을 열어도 이메일·비밀번호 가입은 막힌다 (관리자 계정은 이미 있다. 새 관리자를 만들 때는 훅을 잠깐 끈다)
create function public.hook_before_user_created(event jsonb)
returns jsonb
  language plpgsql set search_path = ''
as $$
begin
  if coalesce(event -> 'user' -> 'app_metadata' ->> 'provider', '') not in ('google', 'kakao') then
    return jsonb_build_object(
      'error', jsonb_build_object('message', '구글이나 카카오로 로그인해 주세요', 'http_code', 403)
    );
  end if;
  return '{}'::jsonb;
end
$$;

revoke execute on function public.hook_before_user_created(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;

commit;
