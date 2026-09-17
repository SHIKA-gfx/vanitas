# logs

## daily-income.csv

한국 서버 청휘석 일일 실측 로그. 수급 계산기 예상값 검증용 (기획서 9장).

| 열 | 내용 |
|---|---|
| date | 날짜 (YYYY-MM-DD) |
| balance | 기록 시점의 청휘석 보유량 |
| spent | 그날 사용한 청휘석 (모집, AP 구매 등) |
| monthly | 월정액 일일 수령분 |
| regular | 정기 수급: 일일·주간 임무, 전술대항전, 총력전·대결전, 이벤트 보상 등 |
| paid_special | 과금 구매(월정액 구매 즉시분 포함), 점검·오류 보상, 쿠폰, 기념 보상 |
| other | 일회성 수급: 인연(모모톡), 스테이지 초회 보상 등 |
| play_level | 플레이 강도: full / main / login |
| event | 진행 중인 이벤트·시즌 (없으면 비움) |
| note | 특이사항 |

### 분류 기준
- 월정액 구매 시 즉시 지급분은 paid_special, 매일 수령분은 monthly
- 반복해서 다시 들어올 수급은 regular, 한 번 받으면 끝나는 수급은 other
- 계산기 검증에는 monthly + regular를 사용한다

### 규칙
- 매일 비슷한 시각에 한 줄씩 추가하고 바로 커밋한다
- 검산식: (balance − 전날 balance) + spent = monthly + regular + paid_special + other
- 첫 줄(기준점)은 수급 분류 열을 비워둔다
- 쉼표가 들어가는 note는 큰따옴표로 감싼다
- 기록을 빠뜨린 날은 행을 만들지 않는다 (추정값 금지)
