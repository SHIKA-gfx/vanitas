<p align="center">
  <a href="https://vanitas.live">
    <img src=".github/assets/readme-banner.png" alt="VANITAS — 블루 아카이브 재화·픽업 플래너" width="100%">
  </a>
</p>

<p align="center">
  <a href="https://vanitas.live"><img src="https://img.shields.io/badge/사이트-vanitas.live-1288f8" alt="사이트: vanitas.live"></a>
  <a href="https://github.com/SHIKA-gfx/vanitas/actions/workflows/build-check.yml"><img src="https://github.com/SHIKA-gfx/vanitas/actions/workflows/build-check.yml/badge.svg" alt="Build check"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/코드-MIT-2a425b" alt="코드: MIT"></a>
  <a href="data/LICENSE"><img src="https://img.shields.io/badge/데이터-CC%20BY%204.0-2a425b" alt="데이터: CC BY 4.0"></a>
</p>

<p align="center">
  <b><a href="https://vanitas.live">vanitas.live</a></b> · 블루 아카이브 비공식 팬 사이트
</p>

---

## VANITAS는

청휘석, AP, 선생님 레벨을 **하나로 이어서** 계산하는 블루 아카이브 플래너예요.

남은 청휘석을 보여주는 데서 멈추지 않고, **"한정된 재화로 원하는 학생을 데려오려면 어떻게 해야할지"** 를 판정하는 걸 목표로 해요.
AP를 사는 데 쓰는 청휘석이 모집 몇 연분인지처럼, 서로 다른 재화가 어떻게 바뀌는지도 함께 보여줘요.

## 계산기

| 계산기                                                   | 알 수 있는 것                                                                                                                            |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| [**천장·확률 계산기**](https://vanitas.live/ko/pity)     | 지금 가진 청휘석과 티켓으로 몇 번 모집할 수 있는지, 천장 전에 나올 확률, 천장까지 가도 남는 청휘석. 확보·부족 판정과 연차별 확률 그래프  |
| [**레벨업 계산기**](https://vanitas.live/ko/levelup)     | 목표 레벨까지 며칠 걸리는지, 또는 그날 몇 레벨일지. 접속 횟수, 카페, 패키지, 전술대회, AP 구매를 반영하고, 최고 레벨이면 숙련증서 획득량 |
| [**청휘석 수급 계산기**](https://vanitas.live/ko/income) | 원하는 날까지 모이는 청휘석. 총력전·대결전·이벤트 일정표를 따라 계산하고, AP 구매에 쓰는 청휘석을 모집 연차로 환산                       |
| **픽업 플래너** (준비 중)                                | 다가오는 픽업 일정에서 어느 픽업에 쓰고 어느 픽업을 넘길지                                                                               |

### 함께 쓰는 기능

- **로그인 없이 자동 저장**: 입력한 값은 이 기기의 브라우저에만 저장되고, 서버로 보내지 않아요
- **결과 공유 링크**: 계산 결과를 링크 하나로 공유해요. 받은 사람의 저장값은 그대로 두고 보여줘요
- **백업 링크**: 세 계산기의 입력을 통째로 다른 기기나 브라우저로 옮겨요
- **모바일**: 휴대폰에서도 같은 기능을 써요

## 게임 데이터

`data/`에는 계산에 쓰는 수치와 일정이 들어 있어요.

- 공식 공지를 먼저 보고, **두 곳 이상의 자료로 교차 확인**해요
- 확인이 끝나지 않은 값은 `verified: false`로 두고, 화면에 "추정"으로 표시해요
- 각 수치의 출처는 [`data/sources.json`](data/sources.json)과 파일마다의 `meta.sources`에 있어요
- 구조와 값은 `validate.py`가 검사해요

수치가 게임과 다르면 [데이터 오류 제보](https://github.com/SHIKA-gfx/vanitas/issues/new/choose)로 알려 주세요.

## 기술

| 영역       | 사용                                       |
| ---------- | ------------------------------------------ |
| 프레임워크 | SvelteKit 2, Svelte 5, TypeScript          |
| 스타일     | Tailwind CSS 4, 경기천년체·Oxanium 웹폰트  |
| 다국어     | Paraglide JS (지금은 한국어)               |
| 테스트     | Vitest, `validate.py` (데이터)             |
| 배포       | Cloudflare Pages, GitHub Actions 빌드 검사 |
| 통계       | Umami (쿠키 없는 익명 통계)                |

계산 로직(`src/lib/calc`)은 데이터 구조를 모르는 순수 함수로 두고, 데이터와의 연결은 어댑터가 맡아요.
화면과 계산을 나눠 두어서, 계산은 화면 없이도 테스트할 수 있어요.

## 로컬에서 실행

Node.js 22가 필요해요.

```bash
npm ci
npm run dev        # http://localhost:5173/ko
```

검사:

```bash
npm run lint
npm run check
npx vitest run
npm run build
python validate.py # 데이터 검사
```

## 폴더

```
src/
├─ lib/
│  ├─ calc/          계산 (천장·확률, 레벨업, 수급)
│  ├─ data/          게임 데이터 조회
│  ├─ state/         저장, 공유 링크, 백업 링크
│  └─ components/    공통 부품
└─ routes/           화면 (pity, levelup, income, about)
data/                게임 데이터 (JSON)
scripts/             웹폰트 줄이기, 아이콘·배너 만들기
```

## 제보와 제안

[이슈](https://github.com/SHIKA-gfx/vanitas/issues/new/choose)에서 양식을 골라 주세요. 데이터 오류, 버그, 기능 제안 세 가지가 있어요.
계산기의 **링크 복사**로 만든 주소를 함께 붙여 주시면, 같은 화면을 바로 열어 확인할 수 있어요.

## 라이선스

- **코드**: [MIT](LICENSE)
- **게임 데이터** (`data/`): [CC BY 4.0](data/LICENSE) — 출처(VANITAS)를 밝히면 자유롭게 쓸 수 있어요
- **글꼴**: 경기천년체(경기도, 공공누리 제1유형), Oxanium([SIL OFL 1.1](static/fonts/Oxanium-OFL.txt))

VANITAS는 블루 아카이브 팬이 만든 비공식 팬 사이트이며 NEXON Games·넥슨코리아·Yostar와 관계가 없습니다.
블루 아카이브 관련 이름과 자료의 권리는 NEXON Games, 넥슨코리아(한국 서비스), Yostar에 있습니다.
VANITAS는 게임의 이미지·아이콘·음악을 사용하지 않습니다.
