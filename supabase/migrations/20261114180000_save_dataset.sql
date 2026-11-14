-- 데이터 문서 저장 함수 (docs/006 6-3-3, ④-4)
--
-- 적용: Supabase 대시보드 → SQL Editor에 이 파일을 통째로 붙여 넣고 한 번 실행한다.
--
-- 문서(datasets 한 행 = 데이터 파일 하나)를 통째로 바꾼다. 관리자 화면이 고친 문서를 글자(JSON)로 보내고,
-- 이 함수가 json으로 바꿔 넣는다 — json 열은 받은 글자 그대로라 키 순서가 남는다 (결정 E).
--
-- 먼저 읽은 판(updated_at)과 지금 판이 같을 때만 바꾼다. 그사이 다른 저장이 문서를 바꿨으면
-- (예: 기간 저장이 schedule.json의 일정 확인일을 바꿈) 덮어쓰지 않고 멈춘다 — 화면이 다시 읽게 한다.
-- 표로 뺀 배열 자리({"$table": …})는 표의 검사 제약이 지킨다 (20261111000000_game_data.sql).
-- 새 문서를 더하거나 지우지 않는다 (파일 10개는 고정, 내보내기가 레포 파일 목록과 맞춰 본다).

begin;

-- p_path      문서 경로 (예: ko/schedule.json)
-- p_data      문서 전체 JSON 글자
-- p_expected  먼저 읽은 판 (datasets.updated_at)
-- p_deploy    true면 같은 저장에서 배포 요청
-- 돌려주는 값 새 판 (updated_at)
create function public.save_dataset(
  p_path text,
  p_data text,
  p_expected timestamptz,
  p_deploy boolean default true
) returns timestamptz
  language plpgsql security invoker set search_path = ''
as $$
declare
  doc json;
  ver timestamptz;
begin
  if not (select public.is_admin()) then
    raise exception '관리자만 저장할 수 있다' using errcode = '42501';
  end if;
  begin
    doc := p_data::json;
  exception when others then
    raise exception 'JSON 문법 오류: %', sqlerrm using errcode = '22P02';
  end;
  if json_typeof(doc) <> 'object' then
    raise exception '문서는 JSON 객체여야 한다' using errcode = '22023';
  end if;

  update public.datasets set data = doc
   where path = p_path and updated_at = p_expected
  returning updated_at into ver;
  if ver is null then
    if exists (select 1 from public.datasets where path = p_path) then
      -- 40001(serialization_failure)은 쓰지 않는다: Data API(PostgREST)가 그 코드는 다시 시도해 응답이 끝나지 않는다
      raise exception '다른 곳에서 먼저 고쳤다 — 다시 읽고 고친다: %', p_path using errcode = 'P0001';
    end if;
    raise exception '없는 문서: %', p_path using errcode = 'P0002';
  end if;

  if p_deploy then
    insert into public.deploy_requests (reason) values (left('문서 저장: ' || p_path, 200));
  end if;
  return ver;
end
$$;

revoke execute on function public.save_dataset(text, text, timestamptz, boolean) from public, anon, service_role;
grant execute on function public.save_dataset(text, text, timestamptz, boolean) to authenticated;

commit;
