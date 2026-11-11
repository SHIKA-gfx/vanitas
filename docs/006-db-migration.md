# 006. DB 이전 설계 (Supabase)

> 작성: 2026-11-04 · 갱신: 2026-11-11 (11/10 공지 반영 #77·#78, 관리자 페이지 필수) · 상태: 설계 초안 — 결정 대기 6건 (10장)
> 관련: 개발 결정 문서 3-3(결정)·5장(보안 개념)·6-8(배포), `docs/005`(미래시 데이터, 10장 `previousIds`), `supabase/migrations/`

## 1. 무엇을 하는가

게임 데이터의 정본을 레포 JSON에서 **Supabase**로 옮기고, **관리자 페이지 `/admin`**에서 고치면 사이트에 반영되게 한다.
수업('실전웹서비스개발') 기말 발표(11월 말)까지. **DB 구축과 관리자 페이지는 필수**(관리자 로그인 포함), 사용자 로그인 저장은 여유가 있을 때.

바꾸지 않는 것

- 방문자 화면, 조회 창구 `src/lib/data/index.ts`, 계산(`src/lib/calc`) — 지금처럼 빌드 때 JSON을 import한다
- 사용자 상태 — 지금처럼 브라우저에만 (개발 결정 문서 3-1)
- v0.2 공개 — JSON PR로 한다 (11/10 공지 반영은 #77·#78로 끝남). DB 쪽은 설정으로 켜고 끄며 기본은 JSON

## 2. 결정

| 날짜 | 항목 | 결정 |
|---|---|---|
| 11-04 | 서비스 | Supabase (지역 Seoul) |
| 11-04 | 읽는 때 | **A안: 빌드 때 읽기 + 저장 시 재배포.** 방문자는 Supabase를 읽지 않는다 |
| 11-04 | 테이블 | **혼합형**: 자주 고치는 미래시(기간·배너·학생)와 출처는 정식 표, 거의 안 바뀌는 설정 파일은 파일 하나 = 행 하나 |
| 11-04 | v0.2 | JSON으로 공개. DB는 설정(`VANITAS_DATA_SOURCE`)으로 켜고 끔, 기본 `json` |
| 11-10 | 기간 id | 시작일로 시작하므로 **날짜가 바뀌면 id도 바뀐다.** 예전 id는 `previousIds`에 남겨 저장된 목표·공유 링크를 잇는다 (`docs/005` 10-2) |
| 11-11 | 관리자 페이지 | **필수** (수업 요구). 관리자 로그인 포함. 사용자 로그인 저장은 선택 그대로 |

방문할 때마다 읽는 B안을 고르지 않은 이유: 조회 함수가 비동기가 되어 화면의 읽기를 모두 고쳐야 하고, Supabase가 멈추면 사이트도 멈춘다.

## 3. 흐름

```
관리자 /admin ── 로그인 ── 저장 (기간 하나를 한 트랜잭션으로) ──▶ Supabase
                                                                  │ 배포 요청 (결정 A)
                                                                  ▼
                                                 Cloudflare Pages 배포 훅 (비밀 주소)
                                                                  ▼
빌드  npm run build:pages
  1. data-export     VANITAS_DATA_SOURCE=db일 때만. DB(공개용 키로 읽기) → data/*.json 덮어쓰기
  2. validate.py     오류면 빌드 중단
  3. vite build      지금과 같다 — data/*.json을 import
                                                                  ▼
방문자 ── vanitas.live ── 빌드에 들어간 데이터만 본다 (Supabase를 읽지 않는다)
```

| 상황 | 결과 |
|---|---|
| 설정 `json` (기본) | 레포 JSON으로 빌드. 1은 건너뛰고 2·3만 — 지금 빌드 + 검사 |
| DB를 못 읽음 (일시정지·네트워크·행이 비어 있음) | 빌드 중단 → 사이트는 이전 버전 (결정 C) |
| `validate.py` 오류 | 빌드 중단 → 사이트는 이전 버전 |

- Cloudflare Pages 빌드 명령을 `npm run build`에서 `npm run build:pages`로 바꾼다 (대시보드). `npm run build`(= `vite build`)는 그대로 두어 빌드 검사 CI가 쓴다
- 빌드 환경의 Python: 빌드 이미지 v3 기본 3.13, v2 기본 3.11. `validate.py`는 표준 라이브러리만 쓰고 3.11 문법으로도 돈다 (확인 2026-11-04). 대시보드에서 빌드 시스템 버전만 확인한다
- 설정은 Production 환경 변수에만 `db`로 둔다. PR 미리보기는 레포 JSON으로 빌드된다

## 4. 테이블 (`supabase/migrations/20261111000000_game_data.sql`)

### 4-1. 원칙

- **DB 제약은 구조, 내용 규칙은 `validate.py`.** 형식·참조·중복은 DB가 막고(잘못된 행이 저장되지 않는다),
  "공지 기간에는 공식 출처", "추정 뒤에 공지 없음", "스택 전환 전 기간 없음" 같은 규칙은 지금처럼 `validate.py`가 빌드에서 막는다.
  관리자 화면은 저장 전에 핵심 검사를 TS로 한 번 더 한다
- **id는 지금 JSON의 id를 그대로 쓴다.** 학생 id는 바꾸지 않는다. 기간 id는 날짜와 함께 바뀌고, 예전 id 표가 잇는다 (4-3)
- 순서가 있는 배열은 `seq`(1부터)로 순서를 저장한다. 파일로 내보낼 때 그 순서를 지킨다

### 4-2. 표

```
sources ◀── recruit_sources ──┐
                              ├── recruits ◀── recruit_banners ◀── banner_students ──▶ students
recruit_previous_ids ─────────┤
                              └── recruit_off_pickup ─────────────────────────────────▶ students

datasets (path → json)      admins ──▶ auth.users      change_log (트리거가 쓴다)
```

| 표 | 무엇 | 키 |
|---|---|---|
| `sources` | 출처 (`sources.json`) | `id` 숫자 문자열 |
| `students` | 학생 (`ko/students.json`) | `id` 슬러그, `game_id` 중복 금지 |
| `recruits` | 픽업 기간 (`schedule.json` `recruits[]`) | `id` |
| `recruit_previous_ids` | 기간의 예전 id (`previousIds`) | (`recruit_id`, `seq`), `old_id` 중복 금지 |
| `recruit_banners` | 기간의 배너 — 종류 | (`recruit_id`, `seq`) |
| `banner_students` | 배너의 픽업 학생 | (`recruit_id`, `banner_seq`, `seq`) |
| `recruit_off_pickup` | 픽업 외 모집 가능 학생 | (`recruit_id`, `seq`) |
| `recruit_sources` | 기간의 출처 | (`recruit_id`, `seq`) |
| `datasets` | 나머지 전부 — 파일 하나 = 행 하나 | `path` (`ko/game-config.json` 등) |
| `admins` | 관리자 목록 | `user_id` → `auth.users` |
| `change_log` | 변경 기록 | `id`, 저장 단위 `tx` |

- 배너 종류(`type`)는 `banner-types.json`(문서형)의 id라 참조 제약을 걸 수 없다 → `validate.py`가 검사
- 기간 id를 바꾸면 예전 id·배너·학생·출처가 따라 바뀐다(`on update cascade`). 학생·출처는 참조 중이면 지울 수 없다
- `free_pulls`(무료 모집)는 #78부터 계산에 쓰인다. 무료 모집을 스택에 넣을지는 문서형 `game-config.json` `chargeSystem.freePulls.accumulate`가 정한다

### 4-3. 예전 id (`recruit_previous_ids`)

`validate.py`의 `previousIds` 검사 네 가지를 DB가 그대로 막는다.

| 검사 | DB |
|---|---|
| 형식 `YYYY-MM-DD-이름` | `old_id` 정규식 check (기간 id와 같은 규칙) |
| 자기 id 아님 | `check (old_id <> recruit_id)` |
| 두 기간이 같은 예전 id를 갖지 않음 | `unique (old_id)` |
| 지금 있는 기간 id와 겹치지 않음 | 두 표에 걸친 규칙이라 **제약 트리거** `check_previous_id_clash` — 트랜잭션이 끝날 때 검사한다 |

- 마지막 검사를 트랜잭션 끝으로 미룬 것은 "id를 바꾸고 예전 id를 더하는" 저장을 순서에 상관없이 한 번에 하기 위해서다
- 예전 날짜로 되돌릴 때(드물다)는 새 id가 자기 예전 id에 있으므로 먼저 그 줄을 뺀다 — 저장 함수가 한다 (6-3)

### 4-4. JSON ↔ 열

| JSON | 표.열 | 내보낼 때 |
|---|---|---|
| `sources.json` `sources{ id: … }` | `sources` | id 숫자 순. 키 순서 publisher, title, date, url, retrievedAt, tier, note |
| `date` | `published` (text) | null도 쓴다. 연도·연월만 있는 출처가 있어 date 형이 아니다 |
| `url` | `url` | null도 쓴다 (출처 39처럼 URL 미확보) |
| `retrievedAt`, `note` | `retrieved_at`, `note` | null이면 키를 뺀다 |
| `students.json` `students[]` | `students` | `seq` 순. `name: { ko, ja }` — ja는 null도 쓴다 |
| `schedule.json` `recruits[]` | `recruits` | `start_date`, id 순. 키 순서 id, start, end, status, event, freePulls, previousIds, banners, offPickup, sources, note |
| `start`, `end`, `freePulls` | `start_date`, `end_date`, `free_pulls` | event·freePulls·note는 null이면, previousIds·offPickup은 비면 키를 뺀다 |
| `previousIds[]` | `recruit_previous_ids` | |
| `banners[].type` / `.students[]` | `recruit_banners` / `banner_students` | |
| 그 밖의 모든 것 | `datasets.data` | 쓴 그대로 |

### 4-5. 문서형 `datasets`

- 10개 파일 모두 한 행씩. 정식 표로 뺀 배열 3개(`schedule.json` `recruits`, `students.json` `students`, `sources.json` `sources`)의 자리에는
  `{"$table": "recruits"}` 같은 **자리 표시**를 둔다. 내보내기가 그 자리에 표 내용을 채운다 — 키 순서가 그대로 남는다.
  DB가 자리 표시를 검사한다 (표 내용의 낡은 사본이 문서에 남지 않게)
- `schedule.json`의 `raids`·`events`·`cadence`·`meta`는 문서형에 둔다 (결정 B)
- **열 형은 `jsonb`가 아니라 `json`** (결정 E). `jsonb`는 키를 다시 정렬한다 — `{"meta", "$schema", "id"}`가 `{"id", "meta", "$schema"}`가 된다.
  `json`은 쓴 글자 그대로 저장하고, Data API가 응답을 만드는 `json_agg`도 그대로 돌려준다(로컬 확인). 대신 DB 안에서 `jsonb_set` 등으로 고치지 않는다 — 화면·스크립트가 통째로 바꿔 넣는다
- 픽업 기간을 저장할 때 `schedule.json` `meta.recruitsVerifiedAt`(플래너의 "일정 확인일")도 갱신한다 → 관리자 화면이 문서를 JS로 고쳐 통째로 저장 (6-3)

### 4-6. 변경 기록 `change_log`

- 게임 데이터 표 9개의 모든 추가·수정·삭제를 트리거가 남긴다: 누가(`actor` = 로그인한 관리자, SQL 편집기면 비어 있음), 언제, 어느 행, 전후 값
- 값이 그대로인 다시 저장은 남기지 않는다. 한 번의 저장(한 트랜잭션)은 같은 `tx`로 묶이고, 보기 `change_log_saves`가 저장 단위로 보여준다
- 관리자만 읽는다. 공개 표에는 사람 정보(누가 고쳤나)를 두지 않는다
- 관리자 페이지의 "변경 기록" 화면과 발표("누가 언제 무엇을 바꿨나")에 쓴다

## 5. 보안

### 5-1. 누가 무엇을 할 수 있나

| 누구 | Postgres 역할 | 게임 데이터 표 | `change_log` | `admins` |
|---|---|---|---|---|
| 방문자·빌드 (공개용 키) | `anon` | 읽기 | ✗ | ✗ |
| 로그인했지만 관리자가 아닌 사람 | `authenticated` | 읽기 (쓰기는 규칙에 걸림) | ✗ (0행) | ✗ |
| 관리자 (`admins`에 있는 `auth.uid()`) | `authenticated` | 읽기·쓰기 | 읽기 | ✗ |
| 비밀 키 | `service_role` | ✗ — 권한을 주지 않는다 | ✗ | ✗ |
| 대시보드 SQL 편집기 | `postgres` (표 주인) | 전부 | 전부 | 전부 |

- 쓰기는 **두 겹**: 표 권한(`grant`)은 `authenticated`에만, 그 안에서 보안 규칙(RLS)이 `is_admin()`인 행만 통과시킨다
- **이 프로젝트는 비밀 키를 쓰지 않는다.** 빌드는 공개용 키로 읽고, 관리자는 로그인으로 쓰고, 처음 넣기는 SQL 편집기로 한다(7장).
  그래서 `service_role`에도 표 권한을 주지 않는다 — 비밀 키가 새도 이 표들은 Data API로 건드릴 수 없다
- 관리자 추가·삭제는 SQL 편집기에서만 (`admins`에는 클라이언트 권한이 없다)
- 2026-05-30 이후 새 Supabase 프로젝트는 public 스키마의 표를 Data API에 자동으로 열지 않는다. 마이그레이션이 권한을 모두 명시적으로 준다(먼저 회수하고 준다 — 프로젝트 설정과 관계없이 같은 결과)
- 함수는 `search_path`를 비워 고정하고(`set search_path = ''`), 실행 권한을 필요한 역할에만 준다. 보기 `change_log_saves`는 `security_invoker`라 `change_log`의 규칙이 그대로 걸린다
- **관리자 화면은 보안 장치가 아니다.** 화면을 숨기거나 우회해도 DB가 쓰기를 막는다. 그래서 관리자 화면에는 서버 비밀이 없고 브라우저에서만 돈다 (6-1)

### 5-2. 로그인

- 이메일 + 비밀번호. **새 가입은 끈다** (Authentication 설정의 "Allow new users to sign up")
- 관리자 계정은 대시보드 Authentication → Users에서 직접 만들고, 그 User UID를 `admins`에 넣는다
- 가입을 끄지 않아도 보안 규칙이 쓰기를 막지만, 쓸모없는 계정이 생기지 않게 끈다

### 5-3. 시험 (로컬 Postgres 16 + Supabase 역할 흉내, 2026-11-11 main #78 데이터)

- 실제 JSON 10개를 넣어 모든 제약 통과: 출처 38 · 학생 34 · 기간 8 · 예전 id 8 · 배너 28 · 픽업 학생 28 · 픽업 외 6 · 기간 출처 12 · 문서 10
- 넣은 것을 다시 꺼내 원본과 비교: 9개 파일은 값과 키 순서까지 같다. `sources.json`은 값은 같고 출처 24·25의 키 순서(url ↔ date)만 다르다 → 서식 맞추기(7-3)에서 정리
- **다시 꺼낸 JSON으로 `data/`를 바꿔 단위 테스트 298개 통과, `validate.py` 오류 0** (테스트가 실데이터 기간 id를 쓰므로 좋은 왕복 기준)
- `anon`: 읽기 O, 쓰기·`admins`·`change_log`·`is_admin()` 권한 없음
- 로그인한 비관리자: 수정 0행, 추가는 보안 규칙 오류, `change_log` 0행
- 관리자: 수정 O, `change_log`에 actor와 전후 값, 같은 값 다시 저장은 기록 없음, 두 표를 고친 한 저장이 `change_log_saves` 한 줄
- 예전 id: 날짜를 바꾸며 id를 바꾸고 예전 id를 더하는 저장이 한 트랜잭션으로 통과, 예전 날짜로 되돌리기(자기 예전 id를 먼저 뺌) 통과.
  지금 있는 id를 예전 id로·두 기간이 같은 예전 id·형식 오류·다른 기간의 예전 id로 이름 바꾸기 모두 거부
- 제약: 없는 학생 참조·참조 중인 학생 삭제·자리 표시 없는 `schedule.json` 거부. 기간 id 변경이 배너·학생·출처·예전 id로 따라감. 출처 순서 맞바꾸기 가능(지연 unique)
- `service_role`: 표 권한 없음
- 같은 시험을 ②에서 CI로 돌릴 수 있다 (GitHub Actions의 postgres 서비스 컨테이너) — 발표에서 "보안 규칙을 시험으로 확인"

### 5-4. 환경 변수와 비밀값

| 이름 | 값 | 어디에 | 공개 |
|---|---|---|---|
| `PUBLIC_SUPABASE_URL` | `https://<프로젝트>.supabase.co` | Cloudflare(Production·Preview), GitHub Actions, 로컬 `.env` | 공개 전제 |
| `PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` | 위와 같음 | 공개 전제 (보안 규칙이 지킨다) |
| `VANITAS_DATA_SOURCE` | `json`(기본) / `db` | Cloudflare Production | — |
| 배포 훅 주소 | Cloudflare가 준 주소 | Supabase 웹훅 설정에만 (결정 A) | **비밀** |
| 관리자 비밀번호 | | 본인만 | **비밀** |

- 레포·채팅·이슈에 비밀값을 쓰지 않는다. 레거시 `anon`·`service_role` JWT 키는 2026년 말 폐지 예정이라 새 키(`sb_publishable_…`)를 쓴다
- 공개용 키도 `.env`에 둔다(`.gitignore` 대상) — 노출돼도 괜찮지만 레포에 박아 두면 키를 바꿀 때 커밋이 필요하다

### 5-5. Supabase 설정 순서 (사용자)

1. 프로젝트 만들기 — 지역 Northeast Asia (Seoul). "새 표 자동 공개"는 꺼진 기본값 그대로
2. SQL Editor에 `supabase/migrations/20261111000000_game_data.sql`을 붙여 넣고 실행
3. Authentication → 이메일 로그인 켜기, 새 가입 끄기
4. Authentication → Users → Add user (본인 이메일·비밀번호, 자동 확인) → User UID 복사 →
   SQL Editor: `insert into public.admins (user_id, note) values ('<UID>', '본인');`
5. Settings → API Keys에서 공개용 키 복사 → 로컬 `.env`. 비밀 키는 쓰지 않는다
6. Security Advisor를 한 번 열어 경고가 있으면 PR에 적는다

## 6. 관리자 페이지 `/admin` (필수, ④)

### 6-1. 방식

- **브라우저에서만 도는 화면** (`ssr = false`). Supabase Auth로 로그인하고, 공개용 키 + 로그인 토큰으로 DB를 직접 읽고 쓴다. 쓰기를 막는 것은 DB의 보안 규칙(5장)
- `@supabase/supabase-js`는 `/admin`에서만 불러온다 — 방문자 화면의 번들은 그대로
- 검색 제외: `<meta name="robots" content="noindex">`, 사이트맵에 넣지 않는다. 사이트에서 들어가는 길은 결정 G
- 문구는 한국어만, 메시지 파일(Paraglide)에 넣지 않는다. 주소의 로케일 접두어(`/ko/admin`)는 ④에서 확인
- 디자인은 사이트 부품(`Panel`·입력칸)과 토큰을 쓴다 (디자인 문서 10장 "새 화면을 만들 때"). 관리 도구라 화려하게 만들지 않는다

### 6-2. 화면

| 순서 | 화면 | 내용 |
|---|---|---|
| 1 | 로그인 | 이메일·비밀번호. 로그인했지만 관리자가 아니면 "관리자 권한이 없어요" (`is_admin()`) |
| 2 | 미래시 목록 | 기간마다 날짜·상태(추정/공지)·배너·무료 모집·수정 시각. 새 기간 |
| 3 | 기간 편집 | 시작·종료일, 상태, 이벤트, 무료 모집, 배너(종류 + 학생, 순서), 픽업 외 학생, 출처, 메모, 예전 id 목록 |
| 4 | 학생·출처 추가 | 기간 편집에서 필요할 때 (학생: id·게임 번호·이름·가칭 / 출처: 발행처·제목·날짜·URL·등급) |
| 5 | 변경 기록 | `change_log_saves` — 언제, 누가, 어느 기간·표 |
| 6 | 문서 편집 (다음) | `datasets` 행을 JSON 그대로. 레이드·이벤트 일정, 설정 파일(`game-config` `chargeSystem.freePulls` 등) |

발표 순서 제안: 로그인 → 기간 하나를 추정 → 공지로 바꿔 저장 → 변경 기록 → 1~2분 뒤 운영 사이트 플래너에 반영.
비관리자 계정으로 같은 저장이 거부되는 것도 보여 줄 수 있다 (결정 G)

### 6-3. 기간 저장

- **기간 하나를 통째로, 한 트랜잭션** — DB 함수(RPC) `save_recruit(원래 id, 기간)`이 기간·예전 id·배너·학생·출처를 한 번에 맞춘다. 보안 규칙이 그대로 걸린다(`security invoker`)
- **시작일을 바꾸면 id가 바뀐다.** 화면이 새 id(`새 시작일-이름`)를 보여 주고 "예전 id `…`는 예전 id 목록에 남아요"라고 알린다.
  저장 함수는 ① 새 id가 자기 예전 id에 있으면 그 줄을 빼고 ② id를 바꾸고(배너·학생·출처·예전 id가 따라감) ③ 원래 id를 예전 id에 더한다
- 저장 전 검사: `validate.py` `check_recruits`의 핵심(날짜 순서, 스택 전환 뒤, 공지 기간의 공식 출처, 빈 배너, 예전 id 규칙, 무료 모집 양수)을 TS로. 최종 검사는 빌드의 `validate.py`
- "일정 확인일을 오늘로"(기본 켬): `schedule.json` `meta.recruitsVerifiedAt`을 같은 저장에서 바꾼다
- 저장하면 재배포 요청 (결정 A). 화면에는 "1~2분 뒤 사이트에 반영"
- 기간 삭제: 그 기간을 고른 목표는 플래너에서 빠진다(`normalizeTargetKeys`). 화면이 한 번 더 묻는다
- `save_recruit`·삭제·배포 요청은 ④의 새 마이그레이션 파일로 더한다

## 7. 넣기·내보내기 (②)

### 7-1. 구조

- **변환은 순수 함수, 통신은 얇게** — 계산 계층과 같은 원칙. `파일 → 행`과 `행 → 파일` 두 함수를 vitest로 왕복 시험한다(DB 없이)
- 내보내기(`scripts/data-export.mjs`): Data API에서 게임 데이터 표 9개를 공개용 키로 읽어(`anon`) `data/*.json`을 쓴다. 문서 10행이 다 있고 정식 표가 비어 있지 않아야 성공 — 아니면 실패로 끝낸다
- 처음 넣기: 스크립트가 **SQL 파일을 만든다** → 사용자가 SQL 편집기에서 실행. 비밀 키가 필요 없다. **전환 직전(⑤)에 그때의 최신 레포 JSON으로 다시 만든다** (지금 기준 기간 8 · 학생 34 · 출처 38)

### 7-2. 왕복 검사

1. JSON → 행 → JSON이 원래 파일과 **값과 키 순서까지** 같다
2. 다시 꺼낸 JSON으로 단위 테스트(실데이터 기간 id를 쓰는 planner·planner-fill·index 테스트 포함)와 `validate.py`가 그대로 통과한다

로컬 Postgres 시험(5-3)에서 둘 다 확인했다. ②에서 시험 코드로 고정한다.

### 7-3. 서식 (결정 E)

레포 JSON 10개 중 8개는 손으로 정렬한 서식이다(짧은 배열을 한 줄에 등). 내보내기는 정해진 규칙으로만 쓸 수 있으므로,
②에서 레포 JSON을 내보내기 서식으로 **한 번 맞추는 커밋**을 둔다 (값 변화 없음). 그 뒤로는 스냅샷 PR에 실제 바뀐 값만 보인다.
페스 공지 데이터 PR(11/16~17 예상)과 겹치지 않게 그 뒤에 한다.

## 8. 운영

- **일시정지 대비**: 무료 프로젝트는 일주일 동안 사용이 적으면 멈춘다. 방문자가 DB를 읽지 않으므로 GitHub Actions 예약 작업이 이틀마다 읽는다 (결정 D와 같은 작업).
  멈추면 대시보드에서 다시 켠다. 공개 레포의 예약 작업은 레포 활동이 60일 없으면 GitHub가 끈다 — 발표 뒤 오래 쉬면 확인
- **전환 뒤 규칙**: `data/`는 DB의 스냅샷이다. 직접 고치지 않는다 — 고친 값은 다음 DB 빌드에서 덮인다. 고칠 것은 `/admin`이나 SQL 편집기로
- **되돌리기**: Cloudflare의 `VANITAS_DATA_SOURCE`를 `json`으로 바꾸고 다시 배포하면 레포 JSON으로 돌아간다
- 무료 한도: Cloudflare Pages 빌드 월 500회. 저장 한 번이 빌드 한 번
- (선택) **사용자 로그인 저장**: 브라우저 저장값(`vanitas:v1`의 `version` + `sections`)을 사용자마다 한 행에 통째로 둔다. 열로 나누지 않으므로
  저장값 모양이 바뀌어도(#78의 `planner.freeLeft`, 공유 이름 `fr`) DB를 고치지 않는다. 읽을 때는 지금처럼 `persistSection`의 검사·`normalizeTargetKeys`를 거친다

## 9. 일정과 PR

| 시기 | v0.2 | DB |
|---|---|---|
| ~11/13 | 실기기 확인 | ① 이 문서 + 마이그레이션 Merge, Supabase 프로젝트·설정(5-5) |
| 11/14~11/18 | 페스 공지 데이터 PR (11/16~17 예상) | ② 넣기·내보내기·왕복 시험·서식 맞추기 → ③ 빌드 연결(`build:pages`, 기본 json) |
| 11/19~11/25 | README 화면 → v0.2 릴리스, 제보 대응 | ④ **`/admin` (필수)**: 로그인, 미래시 목록·편집(id 바꾸기), 저장 함수, 저장 → 재배포, 변경 기록 |
| 11/26~11/30 | | ⑤ DB 읽기로 전환, 예약 작업. 문서·발표 준비. ⑥ 사용자 로그인 저장은 시간이 남을 때만 |

- 관리자 페이지가 필수가 되어 ④를 가장 크게 잡았다. 시간이 모자라면 뒤로 미루는 순서: ⑥ → 문서 편집(6-2의 6) → 스냅샷 PR 자동화(결정 D를 수동으로)
- 발표에 꼭 있어야 하는 것: DB + 보안 규칙, `/admin` 로그인·기간 편집·저장, 저장 → 사이트 반영(③·⑤), 변경 기록
- 마이그레이션은 파일을 더해 간다 (④의 저장 함수·배포 요청은 새 파일). 적용한 파일은 고치지 않는다

## 10. 정할 것 (결정 대기)

**A. 저장 알림 — 무엇이 배포 훅을 부르나** (④에 필요)

- (가) **DB 웹훅** (제안): 저장 함수가 `deploy_requests`에 한 행을 넣고, Supabase Database Webhook(대시보드에서 설정)이 그 행을 보면 배포 훅을 부른다.
  사이트(Worker)에 서버 코드·비밀 변수가 늘지 않는다. 한 저장 = 한 행 = 한 빌드, 배포 요청도 DB에 남는다. SQL 편집기로 고친 뒤에도 한 줄로 배포.
  약점: 웹훅 설정이 레포 밖(대시보드)이라 문서에 절차를 남겨야 하고, 호출 실패를 화면이 바로 모른다
- (나) SvelteKit 서버 경로: 저장 뒤 화면이 서버 경로를 부르고, 서버가 토큰으로 관리자인지 확인한 뒤 배포 훅을 부른다(주소는 Cloudflare 비밀 변수).
  실패를 화면에 바로 알리고 설정이 레포 안에 있다. 약점: 공개 사이트 Worker에 관리용 경로·토큰 검증·런타임 비밀이 생긴다

**B. 레이드·이벤트 일정 — 정식 표로 둘까** (SQL에 영향)

- (가) **문서형** (제안): `schedule.json`의 나머지와 함께 `datasets`. 수급 계산기만 쓰고, 공지 때 몇 줄 고치는 정도라 문서 편집으로 충분하다. 관리자 폼 범위를 미래시에 집중
- (나) 정식 표 `raids`·`events`: 폼으로 고치기 편하지만 id(지금 없음)를 새로 정해야 하고 ④가 커진다

**C. 빌드에서 DB를 못 읽을 때**

- (가) **빌드 중단** (제안): 사이트는 이전 버전에 남는다. 인계 초안은 "레포 JSON으로 빌드"였지만, 그러면 DB에 저장한 값이 스냅샷에 아직 없을 때 사이트 데이터가 **소리 없이 예전으로 돌아간다**.
  코드 배포가 막히면 DB를 다시 켜거나 설정을 `json`으로 바꾼다
- (나) 레포 JSON으로 빌드 (인계 초안)

**D. 레포 JSON(스냅샷)을 DB와 맞추는 방법**

- (가) **예약 작업이 PR** (제안): `.github/workflows/db-snapshot.yml`이 이틀마다(+ 손으로 실행) DB를 읽어 내보내고(= 일시정지 대비), `validate.py`를 돌리고,
  바뀌었으면 "data: DB 스냅샷" PR을 만들거나 갱신한다. 레포 설정 "Allow GitHub Actions to create and approve pull requests"가 필요하다.
  이렇게 만든 PR에는 다른 워크플로가 돌지 않으므로 검사는 같은 작업 안에서 한다
- (나) 예약 작업은 읽기만, 스냅샷은 필요할 때 로컬에서 내보내 PR

**E. 문서형 열과 JSON 서식** (SQL에 영향)

- 열 형은 `json` (제안, 4-5) — 인계 초안의 `jsonb`에서 바꿈. 키 순서를 지키기 위해
- 내보내기 서식: (가) **압축 서식** (제안) — 원시값만 든 짧은 배열·객체는 한 줄(100자 안), 나머지는 2칸 들여쓰기. 지금 손 정렬에 가깝다(서식기 약 30줄) /
  (나) 표준 `JSON.stringify(값, null, 2)` — 코드가 없지만 파일이 길어진다 (`schedule.json` 176 → 721줄, `sources.json` 50 → 321줄)

**G. 관리자 페이지로 가는 길과 시연 계정** — 수업 요구가 "있음을 보여 주기"인지 "채점자가 직접 들어가 보기"인지에 따라

- 들어가는 길: (가) **주소로만** (제안, 링크 없음·검색 제외) / (나) 정보 페이지나 푸터에 작은 "관리자" 링크. 어느 쪽이든 안전은 DB가 지킨다
- 시연 계정: (가) 없음 — 발표에서 직접 시연 / (나) **관리자가 아닌 시연 계정** — 로그인하면 화면은 보이지만 저장은 보안 규칙에 거부된다.
  채점자가 직접 들어가 봐야 한다면 (나)를 제안 (보안 규칙을 눈으로 확인하는 시연도 된다)

**제안대로 두는 것** (이견이 있으면 말한다): 변경 기록 `change_log` 넣음 / 관리자 목록은 `admins` 표 + `is_admin()` / 이메일 + 비밀번호, 가입 끔 /
처음 넣기는 SQL 파일(비밀 키 안 씀) / 관리자 화면은 브라우저 전용·한국어만 / 5-4의 환경 변수 이름 / 표 이름(4-2)

(F "기간 id 고정"은 11/10 작업에서 "id는 날짜와 함께 바뀌고 `previousIds`로 잇는다"로 정해져 닫았다 — 2장)

## 11. 결정 기록

| 날짜 | 결정 |
|---|---|
| 2026-11-04 | Supabase. 빌드 때 읽기 + 저장 시 재배포(A안). 혼합형 테이블. 관리자 로그인은 이번 범위, 사용자 로그인 저장은 선택. v0.2는 JSON (개발 결정 문서 3-3) |
| 2026-11-10 | 기간 id는 날짜와 함께 바뀌고 예전 id는 `previousIds`로 잇는다 (`docs/005` 10-2) → DB는 `recruit_previous_ids` 표, 검사 네 가지를 제약으로 |
| 2026-11-11 | 관리자 페이지는 필수 (수업 요구). 일정에서 ④를 가장 크게, 미룰 순서는 ⑥ → 문서 편집 → 스냅샷 자동화 |
| 2026-11-11 | (제안) DB 제약은 구조, 내용 규칙은 `validate.py`. 순서는 `seq`. id는 지금 JSON의 것 |
| 2026-11-11 | (제안) 비밀 키를 쓰지 않는다 — 빌드는 공개용 키로 읽기, 쓰기는 관리자 로그인, 처음 넣기는 SQL 편집기. `service_role`에도 표 권한 없음 |
| 2026-11-11 | (제안) 문서형 열은 `json`, 표로 뺀 배열 자리에 `{"$table": …}` 자리 표시 |
| 2026-11-11 | (제안) 관리자 화면은 브라우저에서만 돌고 서버 비밀이 없다 — 보안은 DB가 지킨다 |
