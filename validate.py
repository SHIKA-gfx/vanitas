#!/usr/bin/env python3
"""VANITAS 게임 데이터 검증 스크립트.

CI(GitHub Actions)에서 실행해, 미검증 값이나 계산이 깨진 데이터가
배포에 섞여 들어가는 것을 막는다.

사용: python3 validate.py [--strict]
  --strict : verified:false 항목이 있으면 실패 처리 (배포 직전용)
"""
import json, sys, pathlib, datetime

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


# ---------------------------------------------------------------- 천장 규칙 (포인트 → 모집 스택)
PITY_SYSTEMS = {"point_exchange", "charge"}
UNDER_CHARGE = {"replaced", "kept", "unconfirmed"}
# 계산으로 얻는 값은 저장하지 않는다 (설계 원칙 1). 예전에 있던 키가 되살아나지 않게 막는다
DERIVED_KEYS = {"effectivePityCostPyroxene", "nominalPityCostPyroxene"}


def check_pity_rules():
    cfg = load("ko/game-config.json")
    bt = load("ko/banner-types.json")
    src = load("sources.json")["sources"]
    banners = {b["id"]: b for b in bt["bannerTypes"]}
    pools = {p["id"]: p for p in bt["pointPools"]}

    # 1. 날짜별 천장 시스템
    ps = cfg["pitySystem"]
    rows = ps.get("schedule", [])
    if not rows:
        err("game-config: pitySystem.schedule이 비어 있음")
    prev = None
    for i, row in enumerate(rows):
        tag = f"pitySystem.schedule[{i}]"
        if row["system"] not in PITY_SYSTEMS or row["system"] not in ps["available"]:
            err(f"game-config: {tag} system '{row['system']}'이 available에 없음")
        try:
            day = datetime.date.fromisoformat(row["effectiveFrom"])
        except (KeyError, TypeError, ValueError):
            err(f"game-config: {tag} effectiveFrom 형식 오류 (YYYY-MM-DD)")
            continue
        if prev and day <= prev:
            err(f"game-config: {tag} effectiveFrom {day}이 앞 행보다 늦지 않음 (오름차순이어야 한다)")
        prev = day
        if row.get("status") not in {"announced", "estimated"}:
            err(f"game-config: {tag} status는 announced | estimated")
        if i > 0 and row.get("status") == "announced":
            tiers = [src.get(s, {}).get("tier") for s in row.get("sources", [])]
            if "official" not in tiers:
                err(f"game-config: {tag} 공지된 전환인데 공식 출처가 없음")
    if rows and rows[0]["system"] != "point_exchange":
        err("game-config: 한국 서버의 첫 천장 시스템은 point_exchange")
    if "current" in ps:
        err("game-config: pitySystem.current는 쓰지 않는다 — 날짜별 schedule이 정본 (getPitySystem)")

    # 2. 스택 규칙
    cs = cfg["chargeSystem"]
    for key in DERIVED_KEYS & set(cs):
        err(f"game-config: chargeSystem.{key}는 파생값 — 저장하지 않는다")
    soft, hard = cs["softPity"], cs["hardPity"]
    if not 0 < soft["count"] < hard["count"]:
        err(f"game-config: 반천장 {soft['count']} < 천장 {hard['count']}이어야 함")
    if not 0 < soft["pickupChance"] <= 1:
        err(f"game-config: 반천장 픽업 확률 {soft['pickupChance']}은 0 초과 1 이하")

    type_ids = set()
    claimed = {}
    for ct in cs["chargeTypes"]:
        type_ids.add(ct["id"])
        for b in ct["appliesTo"]:
            if b not in banners:
                err(f"game-config: 스택 '{ct['id']}'의 appliesTo '{b}'가 banner-types에 없음")
            if b in claimed:
                err(f"game-config: 배너 '{b}'가 두 스택({claimed[b]}, {ct['id']})에 속함")
            claimed[b] = ct["id"]
    for bid in cs.get("unconfirmedBanners", []):
        if bid not in banners:
            err(f"game-config: unconfirmedBanners '{bid}'가 banner-types에 없음")
        elif banners[bid]["chargeType"] is not None:
            err(f"game-config: '{bid}'는 미확인 배너인데 chargeType이 있음")

    # 3. 마일리지
    mil = cs["mileage"]
    at = mil["tenPullTicketAt"]
    if at != sorted(set(at)) or any(x <= 0 for x in at):
        err(f"game-config: 마일리지 티켓 기준 {at}은 중복 없는 양수 오름차순이어야 함")
    if at and at[-1] > mil["firstTimeLast"]:
        err(f"game-config: 티켓 기준 {at[-1]}이 초회 보상 마지막 단계 {mil['firstTimeLast']}보다 큼")
    for b in mil["sharedAcross"]:
        if b not in banners:
            err(f"game-config: 마일리지 sharedAcross '{b}'가 banner-types에 없음")

    # 4. 배너 ↔ 스택 ↔ 포인트 풀
    for b in banners.values():
        ct = b["chargeType"]
        if ct is not None and ct not in type_ids:
            err(f"banner-types: {b['id']} chargeType '{ct}'가 chargeSystem.chargeTypes에 없음")
        if ct is not None and claimed.get(b["id"]) != ct:
            err(f"banner-types: {b['id']} chargeType '{ct}'와 game-config appliesTo가 다름")
    for p in pools.values():
        if p.get("underCharge") not in UNDER_CHARGE:
            err(f"banner-types: 포인트 풀 {p['id']} underCharge는 {sorted(UNDER_CHARGE)} 중 하나")

    # 개편 후 '준비 중'이 되는 배너 (계산기 목록에서 보이는 것만)
    pending = [b["id"] for b in banners.values()
               if b["availableInKo"] and b["pointPool"] and b["chargeType"] is None
               and pools[b["pointPool"]].get("underCharge") != "kept"]
    unverified = [k for k, v in (("softPity", soft), ("hardPity", hard), ("mileage", mil))
                  if not v.get("verified")]
    print(f"  pity-rules: 전환 {len(rows)}단계 (마지막 {rows[-1]['system']} {rows[-1]['effectiveFrom']}) / "
          f"스택 {len(type_ids)}종 / 마일리지 티켓 {len(at)}장 / 개편 후 준비 중 {pending}"
          + (f" / 미검증 {unverified}" if unverified else ""))
    if mil.get("firstTimeScope") == "unconfirmed":
        warn("game-config: 마일리지 초회 보상이 기간마다 다시 시작되는지 미확인 (기간마다로 가정)")
    if cs.get("pointsAtSwitch", {}).get("value") == "unconfirmed":
        warn("game-config: 전환 시 남은 모집 포인트 처리 미확인 (기간 종료 변환으로 가정)")


# ---------------------------------------------------------------- 픽업 미래시 (플래너, docs/005)
def check_recruits():
    sched = load("ko/schedule.json")
    studs = load("ko/students.json")["students"]
    bt = load("ko/banner-types.json")
    src = load("sources.json")["sources"]
    banners = {b["id"]: b for b in bt["bannerTypes"]}
    first_stack = next(r["effectiveFrom"] for r in load("ko/game-config.json")["pitySystem"]["schedule"]
                       if r["system"] == "charge")

    # 학생
    ids, game_ids = set(), set()
    for st in studs:
        tag = f"students: {st.get('id')}"
        if st["id"] in ids:
            err(f"{tag} id 중복")
        if st["gameId"] in game_ids:
            err(f"{tag} gameId {st['gameId']} 중복")
        ids.add(st["id"])
        game_ids.add(st["gameId"])
        if st.get("koNameStatus") not in {"official", "provisional"}:
            err(f"{tag} koNameStatus는 official | provisional")
        if not st["name"].get("ko"):
            err(f"{tag} 한국어 이름 없음")
        # 괄호 표기: 한국어는 반각 "이름(의상)", 일본어는 전각 "名前（衣装）". 섞이면 화면에서 어긋나 보인다
        ko, ja = st["name"].get("ko") or "", st["name"].get("ja") or ""
        if any(c in ko for c in "（）") or " (" in ko:
            err(f"{tag} 한국어 이름은 반각 괄호, 앞 공백 없이: '{ko}'")
        if any(c in ja for c in "()") or " （" in ja:
            err(f"{tag} 일본어 이름은 전각 괄호, 앞 공백 없이: '{ja}'")
        for name in (ko, ja):
            if name.count("(") + name.count("（") != name.count(")") + name.count("）"):
                err(f"{tag} 괄호 짝이 맞지 않음: '{name}'")
    no_ja = [st["id"] for st in studs if st["koNameStatus"] == "provisional" and not st["name"].get("ja")]
    if no_ja:
        warn(f"students: 가칭 학생 {len(no_ja)}명에 일본 공식 이름 없음 (화면에 함께 적어야 함): {', '.join(no_ja)}")

    # 픽업 기간
    rows = sched.get("recruits", [])
    try:
        datetime.date.fromisoformat(sched["meta"].get("recruitsVerifiedAt", ""))
    except ValueError:
        err("schedule: meta.recruitsVerifiedAt 형식 오류 (YYYY-MM-DD) — 플래너가 '일정 확인일'로 보여준다")
    seen, used, prev = set(), set(), None
    single = []
    for r in rows:
        tag = f"recruits: {r.get('id')}"
        if r["id"] in seen:
            err(f"{tag} id 중복")
        seen.add(r["id"])
        try:
            start = datetime.date.fromisoformat(r["start"])
            end = datetime.date.fromisoformat(r["end"])
        except (KeyError, ValueError):
            err(f"{tag} 날짜 형식 오류")
            continue
        if not r["id"].startswith(r["start"]):
            err(f"{tag} id는 시작일로 시작해야 함 ({r['start']})")
        if end <= start:
            err(f"{tag} end가 start보다 늦지 않음")
        if prev and start < prev:
            err(f"{tag} 시작일 오름차순이 아님")
        prev = start
        if r["start"] < first_stack:
            err(f"{tag} 모집 스택 전환({first_stack}) 이전 기간 — 플래너는 스택 방식만 다룬다")
        status = r.get("status")
        tiers = [src.get(x, {}).get("tier") for x in r.get("sources", [])]
        if None in tiers:
            err(f"{tag} sources.json에 없는 출처")
        if status == "announced" and "official" not in tiers:
            err(f"{tag} 공지된 기간인데 공식 출처가 없음")
        elif status == "estimated":
            if not r.get("sources"):
                err(f"{tag} 추정 기간인데 출처가 없음")
            elif len(r["sources"]) < 2:
                single.append(r["id"])
        elif status not in {"announced", "estimated"}:
            err(f"{tag} status는 announced | estimated")
        if not r.get("banners"):
            err(f"{tag} 배너가 없음")
        for b in r.get("banners", []):
            bt_ = banners.get(b["type"])
            if not bt_:
                err(f"{tag} 배너 종류 '{b['type']}'가 banner-types에 없음")
            elif not bt_["availableInKo"]:
                err(f"{tag} 배너 종류 '{b['type']}'는 한국 미운영")
            if not b.get("students"):
                err(f"{tag} 픽업 학생이 없는 배너")
            for sid in b.get("students", []):
                if sid not in ids:
                    err(f"{tag} 학생 '{sid}'가 students.json에 없음")
                used.add(sid)
        if r.get("freePulls") is not None and r["freePulls"] <= 0:
            err(f"{tag} freePulls는 양수")
    # 공지 뒤에 추정이 오는 것은 괜찮지만, 추정 뒤에 공지가 오면 순서가 틀린 것
    seen_est = False
    for r in rows:
        if r["status"] == "estimated":
            seen_est = True
        elif seen_est:
            err(f"recruits: {r['id']} 추정 기간 뒤에 공지된 기간이 있음")
    orphan = sorted(ids - used)
    if orphan:
        warn(f"students: 어느 픽업에도 없는 학생 {len(orphan)}명: {', '.join(orphan)}")
    if single:
        warn(f"recruits: 출처가 하나뿐인 추정 기간 {len(single)}건 (교차 확인 전): {', '.join(single)}")
    n_ann = sum(1 for r in rows if r["status"] == "announced")
    span = f"{rows[0]['start']} ~ {rows[-1]['end']}" if rows else "-"
    print(f"  recruits: {len(rows)}기간 ({span}) / 공지 {n_ann}·추정 {len(rows) - n_ann} / "
          f"배너 {sum(len(r['banners']) for r in rows)}개 / 학생 {len(ids)}명 (가칭 "
          f"{sum(1 for st in studs if st['koNameStatus'] == 'provisional')})")


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
                "ko/game-config.json", "ko/banner-types.json", "ko/ap-config.json",
                "ko/income-sources.json", "ko/schedule.json", "ko/students.json"]:
        d = load(rel)
        for sid in d["meta"].get("sources", []):
            if sid.isdigit() and sid not in src:
                err(f"{rel}: 출처 [{sid}]가 sources.json에 없음")
    for sid, s in src.items():
        if not s.get("url"):
            warn(f"sources: [{sid}] {s['publisher']} — URL 미확보")
    print(f"  sources: {len(src)}건")
    
# ---------------------------------------------------------------- 수급원
PERIODS = {"daily", "weekly", "every10days", "perSeason", "perSeasonDay", "perEvent", "irregular"}
# 일정표를 따르는 주기 → schedule 필드 필수
SCHEDULED_PERIODS = {"perSeason", "perSeasonDay", "perEvent"}
SCHEDULE_STREAMS = {"totalAssault", "grandAssault", "event"}
UNITS = {"pyroxene", "tenPullTicket"}


def check_income_sources(strict):
    d = load("ko/income-sources.json")
    rows = d["sources"]
    ids = set()
    paid_ids = set()
    unverified = 0

    for s in rows:
        sid = s.get("id", "?")
        if not sid or sid in ids:
            err(f"income-sources: id 누락 또는 중복 ({sid})")
        ids.add(sid)
        if s.get("paid"):
            paid_ids.add(sid)

        period = s.get("period")
        if period not in PERIODS:
            err(f"income-sources: {sid} period '{period}' 허용 목록 밖")
        if period in SCHEDULED_PERIODS:
            if s.get("schedule") not in SCHEDULE_STREAMS:
                err(f"income-sources: {sid} period '{period}'인데 schedule "
                    f"'{s.get('schedule')}'이 없거나 허용 목록 밖")
        elif "schedule" in s:
            warn(f"income-sources: {sid} period '{period}'에는 schedule이 쓰이지 않음")

        if s.get("unit", "pyroxene") not in UNITS:
            err(f"income-sources: {sid} unit '{s.get('unit')}' 허용 목록 밖")

        # amount는 계산기 기본값, tiers/amountRange/samples는 불확실성 표현
        amt = s.get("amount")
        alts = [k for k in ("tiers", "amountRange", "samples") if k in s]
        if amt is None and not alts:
            err(f"income-sources: {sid} 금액 정보 없음 (amount / tiers / amountRange / samples)")

        if "tiers" in s:
            tiers = s["tiers"]
            if not isinstance(tiers, list) or not tiers:
                err(f"income-sources: {sid} tiers가 비어 있거나 목록이 아님")
            else:
                tier_ids = set()
                for t in tiers:
                    if not isinstance(t, dict) or "amount" not in t:
                        err(f"income-sources: {sid} tiers 항목은 amount를 가진 객체여야 함")
                        continue
                    if not t.get("id") or not t.get("label"):
                        err(f"income-sources: {sid} tiers 항목에 id 또는 label 없음 — 등급 선택 UI 불가")
                    elif t["id"] in tier_ids:
                        err(f"income-sources: {sid} tiers id 중복 ({t['id']})")
                    tier_ids.add(t.get("id"))
                amounts = [t["amount"] for t in tiers if isinstance(t, dict) and "amount" in t]
                if amounts != sorted(amounts):
                    warn(f"income-sources: {sid} tiers가 금액 오름차순이 아님")
                if not s.get("tierNote"):
                    warn(f"income-sources: {sid} tiers가 있는데 tierNote 없음 — 등급 선택 안내 불가")

        if "amountRange" in s:
            r = s["amountRange"]
            if "min" not in r or "max" not in r:
                err(f"income-sources: {sid} amountRange에 min/max 없음")
            elif r["min"] > r["max"]:
                err(f"income-sources: {sid} amountRange min({r['min']}) > max({r['max']})")
            elif amt is not None and not (r["min"] <= amt <= r["max"]):
                err(f"income-sources: {sid} 기본값 {amt}이 범위 {r['min']}~{r['max']} 밖")

        if "samples" in s:
            if not s["samples"]:
                err(f"income-sources: {sid} samples가 비어 있음")
            for sm in s["samples"]:
                if "date" not in sm or "amount" not in sm:
                    err(f"income-sources: {sid} samples 항목에 date 또는 amount 없음")

        if not s.get("verified", False):
            unverified += 1

    # 정액 상품 (월정액·반정액)
    subs = d.get("subscriptions", [])
    for sub in subs:
        sid = sub.get("id", "?")
        if sid in ids:
            err(f"income-sources: 정액 상품 id '{sid}'가 수급원 id와 겹침")
        for k in ("instant", "daily", "durationDays"):
            v = sub.get(k)
            if not isinstance(v, int) or v < 0 or (k == "durationDays" and v == 0):
                err(f"income-sources: 정액 상품 {sid} {k} 값 {v}가 올바르지 않음")
        paid_ids.add(sid)
        if not sub.get("verified", False):
            unverified += 1

    # 이벤트 참여도
    part_ids = set()
    for p in d.get("eventParticipation", []):
        if p.get("id") in part_ids:
            err(f"income-sources: eventParticipation id 중복 ({p.get('id')})")
        part_ids.add(p.get("id"))
        f = p.get("factor")
        if not isinstance(f, (int, float)) or not (0 <= f <= 1):
            err(f"income-sources: eventParticipation '{p.get('id')}' factor {f}가 0~1 밖")

    # 프리셋 = 포함할 수급원 묶음 (2026-09-26, 계수 방식에서 변경)
    presets = {k: v for k, v in d.get("presets", {}).items() if not k.startswith("_")}
    for name, p in presets.items():
        if not isinstance(p, dict):
            err(f"income-sources: 프리셋 '{name}' 형식 오류 (객체가 아님)")
            continue
        if not p.get("label"):
            err(f"income-sources: 프리셋 '{name}'에 label 없음")
        include = p.get("include")
        if not isinstance(include, list) or not include:
            err(f"income-sources: 프리셋 '{name}'의 include가 비어 있거나 목록이 아님")
            continue
        if len(set(include)) != len(include):
            err(f"income-sources: 프리셋 '{name}'의 include에 중복")
        for rid in include:
            if rid in paid_ids:
                err(f"income-sources: 프리셋 '{name}'에 유료 수급원 '{rid}' — 정액은 따로 입력받는다")
            elif rid not in ids:
                err(f"income-sources: 프리셋 '{name}'이 없는 수급원 '{rid}' 참조")

    print(f"  income-sources: {len(rows)}종 + 정액 {len(subs)}종 / 미검증 {unverified}개 / "
          f"프리셋 {len(presets)}종")

    if strict and unverified:
        err(f"income-sources: --strict 모드에서 미검증 수급원 {unverified}개 발견")


# ---------------------------------------------------------------- 일정표
SCHEDULE_STATUS = {"announced", "estimated"}
EVENT_KINDS = {"new", "rerun"}


def _dates(tag, row):
    """start/end를 date로. 형식 오류나 순서 오류면 None."""
    try:
        start = datetime.date.fromisoformat(row["start"])
        end = datetime.date.fromisoformat(row["end"])
    except (KeyError, TypeError, ValueError):
        err(f"schedule: {tag} 날짜 형식 오류 (start/end는 YYYY-MM-DD)")
        return None
    if end <= start:
        err(f"schedule: {tag} 종료일 {end}이 시작일 {start}보다 앞이거나 같음")
        return None
    return start, end


def check_schedule():
    d = load("ko/schedule.json")
    cadence = d["cadence"]
    by_kind = {}

    for r in d["raids"]:
        kind = r.get("kind")
        tag = f"{kind} #{r.get('season')}"
        if kind not in cadence:
            err(f"schedule: {tag} kind가 cadence에 없음")
            continue
        if r.get("status") not in SCHEDULE_STATUS:
            err(f"schedule: {tag} status '{r.get('status')}' 허용 목록 밖")
        dates = _dates(tag, r)
        if not dates:
            continue
        if (dates[1] - dates[0]).days != cadence[kind]["durationDays"]:
            warn(f"schedule: {tag} 기간 {(dates[1] - dates[0]).days}일 "
                 f"(cadence {cadence[kind]['durationDays']}일과 다름)")
        by_kind.setdefault(kind, []).append((r, dates))

    # 같은 종류끼리: 순서, 겹침, 공지·추정 순서, 주기
    irregular = []
    for kind, rows in by_kind.items():
        for (pr, (ps, pe)), (cr, (cs, ce)) in zip(rows, rows[1:]):
            tag = f"{kind} #{pr.get('season')}→#{cr.get('season')}"
            if cr.get("season", 0) <= pr.get("season", 0):
                err(f"schedule: {tag} 시즌 번호가 증가하지 않음")
            if cs < pe:
                err(f"schedule: {tag} 기간이 겹침 ({pe} 종료 전 {cs} 시작)")
            if pr.get("status") == "estimated" and cr.get("status") == "announced":
                err(f"schedule: {tag} 추정 일정 뒤에 공지 일정이 있음 — 앞 일정의 status 확인")
            gap = (cs - ps).days
            if gap != cadence[kind]["intervalDays"]:
                irregular.append(f"{kind} #{pr.get('season')}→#{cr.get('season')} {gap}일")

    ev_prev = None
    for e in d["events"]:
        tag = f"event '{e.get('name')}'"
        if not e.get("name"):
            err("schedule: 이름 없는 이벤트")
        if e.get("kind") not in EVENT_KINDS:
            err(f"schedule: {tag} kind '{e.get('kind')}' 허용 목록 밖")
        if e.get("status") not in SCHEDULE_STATUS:
            err(f"schedule: {tag} status '{e.get('status')}' 허용 목록 밖")
        dates = _dates(tag, e)
        if dates and ev_prev and dates[0] < ev_prev:
            err(f"schedule: {tag} 시작일이 앞 이벤트보다 빠름 (시작일 순서로 적을 것)")
        if dates:
            ev_prev = dates[0]

    counts = ", ".join(f"{k} {len(v)}회" for k, v in by_kind.items())
    estimated = sum(1 for r in d["raids"] if r.get("status") == "estimated") + \
        sum(1 for e in d["events"] if e.get("status") == "estimated")
    print(f"  schedule: 레이드 {counts} / 이벤트 {len(d['events'])}회 / 추정 {estimated}건")
    if irregular:
        # 공백·단축 구간은 실제 일정이라 오류가 아니다. 눈으로 확인하도록 목록만 보여준다
        print(f"    주기가 28일이 아닌 구간: {'; '.join(irregular)}")


# ---------------------------------------------------------------- 일일 로그
def check_income_log():
    path = pathlib.Path(__file__).parent / "logs" / "daily-income.csv"
    if not path.exists():
        warn("logs/daily-income.csv 없음 — 검산 생략")
        return

    import csv as _csv
    with open(path, encoding="utf-8", newline="") as f:
        rows = list(_csv.DictReader(f))
    if not rows:
        warn("daily-income.csv: 기록 없음")
        return

    cols = ["balance", "spent", "monthly", "regular", "paid_special", "other"]
    prev_date = prev_bal = None
    mismatch = 0

    for i, r in enumerate(rows):
        d = r["date"]
        if any(r.get(c) is None for c in cols):
            err(f"daily-income: {d} 열 개수 부족")
            continue
        if prev_date and d <= prev_date:
            err(f"daily-income: {d} 날짜가 오름차순이 아니거나 중복")

        try:
            vals = {c: int(r[c]) if r[c].strip() else None for c in cols}
        except ValueError:
            err(f"daily-income: {d} 숫자가 아닌 값 포함")
            prev_date = d
            continue

        if vals["balance"] is None:
            err(f"daily-income: {d} balance 누락")
        elif i > 0 and prev_bal is not None:
            income = [vals[c] for c in ("monthly", "regular", "paid_special", "other")]
            if any(v is None for v in income):
                warn(f"daily-income: {d} 수급 분류가 비어 있어 검산 생략")
            else:
                diff = vals["balance"] - prev_bal + (vals["spent"] or 0)
                if diff != sum(income):
                    err(f"daily-income: {d} 잔고변화+사용 {diff} != 수급합계 {sum(income)}")
                    mismatch += 1

        prev_date, prev_bal = d, vals["balance"]

    print(f"  daily-income: {len(rows)}행 ({rows[0]['date']} ~ {rows[-1]['date']}) / "
          f"검산 불일치 {mismatch}건")

# ---------------------------------------------------------------- 실행
def main():
    strict = "--strict" in sys.argv
    print(f"VANITAS 데이터 검증{' (strict)' if strict else ''}\n" + "-" * 52)
    check_level_table()
    check_cafe()
    check_banners(strict)
    check_pity_rules()
    check_recruits()
    check_pool_sizes()
    check_ap()
    check_income_sources(strict)
    check_schedule()
    check_sources()
    check_income_log()
    print("-" * 52)

    for w in warnings:
        print(f"경고  {w}")
    for e in errors:
        print(f"오류  {e}")
    print(f"\n오류 {len(errors)}건 / 경고 {len(warnings)}건")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
