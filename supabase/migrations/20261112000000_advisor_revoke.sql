-- Security Advisor 경고 처리 (2026-11-12, docs/006 5-6)
--
-- 운영 프로젝트에는 SQL Editor에서 이미 실행했다. 이 파일은 기록이다 — 다시 실행해도 결과가 같다.
--
-- rls_auto_enable(): 프로젝트를 만들 때 켠 "Enable automatic RLS"가 만든 이벤트 트리거 함수(security definer).
-- 경고: anon·authenticated가 부를 수 있다. 이벤트 트리거는 실행 권한과 관계없이 돌므로 거둬도 자동 RLS는 그대로다.
-- 그 설정을 켜지 않은 프로젝트(로컬 시험 등)에는 함수가 없으므로 있을 때만 거둔다.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end
$$;

-- 그대로 두는 경고 (이유는 docs/006 5-6)
--   is_admin()을 authenticated가 부를 수 있다 — 보안 규칙과 관리자 화면이 쓴다. 부른 사람 자신이 관리자인지만 알려 준다
--   유출 비밀번호 검사 꺼짐 — 무료 요금제에서 켤 수 없다. 새 가입 끔 + 관리자 계정 하나로 대신한다
