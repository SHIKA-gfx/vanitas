#!/usr/bin/env python3
"""VANITAS 게임 데이터 검증 스크립트.

CI(GitHub Actions)에서 실행해, 미검증 값이나 계산이 깨진 데이터가
배포에 섞여 들어가는 것을 막는다.

사용: python3 validate.py [--strict]
  --strict : verified:false 항목이 있으면 실패 처리 (배포 직전용)
"""
import json, sys, pathlib

ROOT = pathlib.Path(__file__).parent / "data"
errors, warnings = [], []


def load(rel):
    with open(ROOT / rel, encoding="utf-8") as f:
        return json.load(f)


def err(msg):
    errors.append(msg)


def warn(msg):
    warnings.append(msg)


# ---------------------------------------------------------------- 레벨 테이블
def check_level_table():
    d = load("shared/level-table.json")
    levels = d["levels"]
    cap = d["meta"]["levelCap"]

    if len(levels) != cap:
        err(f"level-table: 행 수 {len(levels)} != levelCap {cap}")

    # 누적 경험치 정합성
    cum = 0
    for i, row in enumerate(levels):
        if row["expCumulative"] != cum:
            err(f"level-table: L{row['level']} expCumulative {row['expCumulative']} != 계산 {cum}")
        if row["expToNext"] is not None:
            cum += row["expToNext"]
        elif row["level"] != cap:
            err(f"level-table: L{row['level']} expToNext가 null인데 최종 레벨이 아님")

    # AP 최대치 규칙 정합성
    rule = d["apMaxRule"]
    for row in levels:
        lv = row["level"]
        expected = rule["base"]
        for inc in rule["increments"]:
            span = max(0, min(lv, inc["toLevel"]) - inc["fromLevel"])
            expected += span * inc["perLevel"]
        if row["apMax"] != expected:
            err(f"level-table: L{lv} apMax {row['apMax']} != 규칙 계산 {expected}")

    # derived 재계산
    dv = d["derived"]
    total = levels[-1]["expCumulative"]
    bonus = sum(r["apMax"] for r in levels if r["level"] >= 2)
    if dv["totalExpToCap"] != total:
        err(f"level-table: totalExpToCap {dv['totalExpToCap']} != {total}")
    if dv["levelUpBonusApTotal"] != bonus:
        err(f"level-table: levelUpBonusApTotal {dv['levelUpBonusApTotal']} != {bonus}")
    if dv["netApToCap"] != total - bonus:
        err(f"level-table: netApToCap {dv['netApToCap']} != {total - bonus}")

    print(f"  level-table: {len(levels)}행 / 총 {total:,} EXP / 레벨업 보너스 {bonus:,} AP")


# ---------------------------------------------------------------- 카페
def check_cafe():
    d = load("shared/cafe-ranks.json")
    ranks = d["ranks"]
    prev_comfort = prev_storage = None
    for r in ranks:
        base = r["maxStorage"] / 96
        mx = base + r["maxComfort"] * r["apPerComfort"]
        full_h = r["maxStorage"] / mx
        if not (23.0 <= full_h <= 24.5):
            warn(f"cafe: 랭크 {r['rank']} 만충 {full_h:.2f}h — 24h 패턴에서 벗어남")
        if prev_comfort is not None and r["maxComfort"] - prev_comfort != 500:
            warn(f"cafe: 랭크 {r['rank']} 최대 쾌적도 증가폭이 500이 아님")
        if prev_storage is not None and r["rank"] >= 6 and r["maxStorage"] - prev_storage != 70:
            warn(f"cafe: 랭크 {r['rank']} 보관량 증가폭이 70이 아님")
        prev_comfort, prev_storage = r["maxComfort"], r["maxStorage"]
    r10 = ranks[-1]
    base10 = r10["maxStorage"] / 96
    mx10 = base10 + r10["maxComfort"] * r10["apPerComfort"]
    print(f"  cafe-ranks: {len(ranks)}랭크 / 10랭크 최대 {mx10:.4f} AP/h "
          f"(만충 {r10['maxStorage']/mx10:.2f}h)")


# ---------------------------------------------------------------- 배너 확률
def check_banners(strict):
    d = load("ko/banner-types.json")
    pools = {p["id"] for p in d["pointPools"]}
    unverified = 0

    for bt in d["bannerTypes"]:
        if bt["pointPool"] and bt["pointPool"] not in pools:
            err(f"banner-types: {bt['id']} pointPool '{bt['pointPool']}' 미정의")

        for variant, groups in bt["rateGroups"].items():
            total = round(sum(g["rate"] for g in groups), 6)
            if abs(total - 100.0) > 1e-6:
                err(f"banner-types: {bt['id']}.{variant} 확률 합 {total} != 100")
            for g in groups:
                if not g.get("verified", False):
                    unverified += 1

        if bt["id"] == "pickup_normal":
            if "withPickup2Star" not in bt["rateGroups"]:
                err("banner-types: pickup_normal에 withPickup2Star variant 누락")
            if "tenthPull" not in bt["rateGroups"]:
                err("banner-types: pickup_normal에 tenthPull variant 누락")
            base3 = sum(g["rate"] for g in bt["rateGroups"]["default"] if g["rarity"] == 3)
            tenth3 = sum(g["rate"] for g in bt["rateGroups"]["tenthPull"] if g["rarity"] == 3)
            if abs(base3 - tenth3) > 1e-9:
                err(f"banner-types: 10회차 ★3 확률 {tenth3} != 기본 {base3} "
                    "(공시상 동일해야 하며, 다르면 닫힌 식이 깨진다)")

    ko_types = [b["id"] for b in d["bannerTypes"] if b["availableInKo"]]
    print(f"  banner-types: {len(d['bannerTypes'])}종 (한국 운영 {len(ko_types)}종) / "
          f"미검증 그룹 {unverified}개")
    if strict and unverified:
        err(f"banner-types: --strict 모드에서 미검증 확률 그룹 {unverified}개 발견")


# ---------------------------------------------------------------- 풀 크기 대조
def check_pool_sizes():
    bt = load("ko/banner-types.json")
    ps = load("ko/pool-sizes.json")
    snap = ps["snapshots"][0]

    normal = next(b for b in bt["bannerTypes"] if b["id"] == "pickup_normal")
    for g in normal["rateGroups"]["default"]:
        pool = snap["pools"].get(g["poolRef"])
        if not pool:
            continue
        if abs(pool["groupRate"] - g["rate"]) > 1e-9:
            err(f"pool-sizes: {g['poolRef']} groupRate {pool['groupRate']} != "
                f"banner-types {g['rate']}")
        calc = round(pool["groupRate"] / pool["size"], 6)
        if abs(calc - pool["perUnitRate"]) > 1e-6:
            err(f"pool-sizes: {g['poolRef']} 개별 확률 {pool['perUnitRate']} != "
                f"{pool['groupRate']}/{pool['size']} = {calc}")

    if snap.get("bannerPeriodUnrecorded"):
        warn("pool-sizes: 스냅샷의 배너 기간이 기록되지 않음 — 풀 크기 시점 추적 불가")
    print(f"  pool-sizes: 스냅샷 {len(ps['snapshots'])}건 / 미수집 풀 {len(ps['pending'])}종")


# ---------------------------------------------------------------- AP
def check_ap():
    d = load("ko/ap-config.json")
    rec = d["recovery"]
    if rec["apPerHour"] * 24 != rec["apPerDay"]:
        err("ap-config: apPerDay가 apPerHour*24와 불일치")
    if 60 / rec["minutesPerAp"] != rec["apPerHour"]:
        err("ap-config: minutesPerAp와 apPerHour 불일치")

    tiers = d["purchase"]["priceTiers"]
    expect = 1
    total_cost = total_ap = 0
    for t in tiers:
        if t["fromCount"] != expect:
            err(f"ap-config: 구매 단가 구간이 연속되지 않음 ({expect} 기대, {t['fromCount']} 발견)")
        n = t["toCount"] - t["fromCount"] + 1
        total_cost += n * t["price"]
        total_ap += n * d["purchase"]["apPerPurchase"]
        expect = t["toCount"] + 1
    if expect - 1 != d["purchase"]["maxPurchasesPerDay"]:
        err(f"ap-config: 단가 구간 합 {expect-1} != maxPurchasesPerDay "
            f"{d['purchase']['maxPurchasesPerDay']}")

    lt = load("shared/level-table.json")
    cap_ap = lt["levels"][-1]["apMax"]
    if cap_ap != rec["apPerDay"]:
        warn(f"교차: 만렙 AP 최대치 {cap_ap} != 일일 자연회복 {rec['apPerDay']}")
    if d["expConversion"]["apToExp"] != 1:
        warn("ap-config: 경험치 교환비가 1이 아님 — 레벨업 계산기 식 재확인 필요")

    print(f"  ap-config: 20회 전량 구매 시 청휘석 {total_cost:,} / AP {total_ap:,} "
          f"(AP 1당 {total_cost/total_ap:.3f})")


# ---------------------------------------------------------------- 출처
def check_sources():
    src = load("sources.json")["sources"]
    for rel in ["shared/level-table.json", "shared/cafe-ranks.json",
                "ko/game-config.json", "ko/banner-types.json", "ko/ap-config.json"]:
        d = load(rel)
        for sid in d["meta"].get("sources", []):
            if sid.isdigit() and sid not in src:
                err(f"{rel}: 출처 [{sid}]가 sources.json에 없음")
    for sid, s in src.items():
        if not s.get("url"):
            warn(f"sources: [{sid}] {s['publisher']} — URL 미확보")
    print(f"  sources: {len(src)}건")


# ---------------------------------------------------------------- 실행
def main():
    strict = "--strict" in sys.argv
    print(f"VANITAS 데이터 검증{' (strict)' if strict else ''}\n" + "-" * 52)
    check_level_table()
    check_cafe()
    check_banners(strict)
    check_pool_sizes()
    check_ap()
    check_sources()
    print("-" * 52)

    for w in warnings:
        print(f"경고  {w}")
    for e in errors:
        print(f"오류  {e}")
    print(f"\n오류 {len(errors)}건 / 경고 {len(warnings)}건")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
