#!/usr/bin/env bash
# 청휘석 일일 실측 로그 기록 도구
# 사용법: bash scripts/log-income.sh [YYYY-MM-DD]   (날짜 생략 시 오늘)
set -euo pipefail

cd "$(dirname "$0")/.."
CSV="logs/daily-income.csv"
[ -f "$CSV" ] || { echo "오류: $CSV 없음"; exit 1; }

git pull --quiet --ff-only || echo "경고: git pull 실패. 원격과 다를 수 있음"

DATE="${1:-$(date +%F)}"
echo "$DATE" | grep -qE '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' || { echo "오류: 날짜 형식은 YYYY-MM-DD"; exit 1; }

if awk -F, -v d="$DATE" 'NR>1 && $1==d {f=1} END{exit !f}' "$CSV"; then
  echo "오류: $DATE 기록이 이미 있습니다."
  exit 1
fi

LAST=$(awk -F, 'NR>1 && NF>1 {l=$0} END{print l}' "$CSV")
PREV_DATE=$(echo "$LAST" | cut -d, -f1)
PREV_BAL=$(echo "$LAST" | cut -d, -f2)
PREV_LEVEL=$(echo "$LAST" | cut -d, -f8)
PREV_EVENT=$(echo "$LAST" | cut -d, -f9)

echo
echo "기록일: $DATE   (직전 기록 $PREV_DATE, 잔고 $PREV_BAL)"
echo "숫자 항목은 비우면 0으로 기록됩니다."
echo

num() { # num "설명" -> 정수만 허용, 빈 입력은 0
  local v
  while true; do
    read -r -p "$1: " v
    v="${v:-0}"
    if echo "$v" | grep -qE '^-?[0-9]+$'; then echo "$v"; return; fi
    echo "  숫자만 입력하세요." >&2
  done
}

csv() { # 쉼표·따옴표가 있으면 CSV 규칙대로 감싸기
  case "$1" in
    *,*|*\"*) printf '"%s"' "$(printf '%s' "$1" | sed 's/"/""/g')" ;;
    *) printf '%s' "$1" ;;
  esac
}

BAL=$(num "현재 청휘석 잔고")
SPENT=$(num "사용 (모집·AP 구매 등)")
MONTHLY=$(num "월정액 일일 수령분")
REGULAR=$(num "정기 수급 (임무·대항전·총력전·이벤트)")
PAID=$(num "과금·특수 (구매·점검보상·쿠폰)")
OTHER=$(num "기타 (인연·초회보상 등)")

read -r -p "플레이 강도 (full/main/login) [${PREV_LEVEL:-full}]: " LEVEL
LEVEL="${LEVEL:-${PREV_LEVEL:-full}}"
read -r -p "이벤트 [${PREV_EVENT}] (없으면 - 입력): " EVENT
EVENT="${EVENT:-$PREV_EVENT}"
[ "$EVENT" = "-" ] && EVENT=""
read -r -p "메모: " NOTE

DIFF=$(( BAL - PREV_BAL + SPENT ))
SUM=$(( MONTHLY + REGULAR + PAID + OTHER ))

echo
echo "── 검산 ──────────────────────────────"
echo "  잔고변화 + 사용 : $DIFF"
echo "  수급 합계       : $SUM"
if [ "$DIFF" -eq "$SUM" ]; then
  echo "  일치"
else
  echo "  불일치 (차이 $(( DIFF - SUM ))) — 빠뜨린 수급이 있는지 확인하세요"
fi
echo "──────────────────────────────────────"
echo

ROW="$DATE,$BAL,$SPENT,$MONTHLY,$REGULAR,$PAID,$OTHER,$LEVEL,$(csv "$EVENT"),$(csv "$NOTE")"
echo "기록할 내용:"
echo "  $ROW"
echo
read -r -p "이대로 기록할까요? (y/N): " OK
case "$OK" in [yY]*) ;; *) echo "취소했습니다."; exit 0 ;; esac

[ -n "$(tail -c1 "$CSV")" ] && echo >> "$CSV"
echo "$ROW" >> "$CSV"

git add "$CSV"
git commit --quiet -m "log: $DATE"
git push --quiet
echo "기록 완료: $DATE"
