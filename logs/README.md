# logs

## daily-income.csv

한국 서버 청휘석 일일 실측 로그. 수급 계산기 예상값 검증용 (기획서 9장).

| 열 | 내용 |
|---|---|
| date | 날짜 (YYYY-MM-DD) |
| balance | 기록 시점의 청휘석 보유량 |
| spent | 그날 사용한 청휘석 (모집, AP 구매 등) |
| purchased | 그날 과금으로 구매한 청휘석 |
| play_level | 플레이 강도: full / main / login |
| event | 진행 중인 이벤트·시즌 (없으면 비움) |
| note | 특이사항 (점검 보상, 쿠폰, 총력전 정산 등) |

### 규칙
- 매일 비슷한 시각에 한 줄씩 추가하고 바로 커밋한다
- 획득량은 저장하지 않는다: (오늘 balance − 전날 balance) + spent − purchased
- 쉼표가 들어가는 note는 큰따옴표로 감싼다
- 기록을 빠뜨린 날은 행을 만들지 않는다 (추정값 금지)
