/**
 * 천장·확률 계산기 핵심 로직.
 *
 * 설계 원칙
 * - 이 파일은 `data/` JSON 구조를 알지 않는다. 모든 수치는 인자로 받는다.
 *   (조회 함수 → 인자 변환은 호출부 어댑터가 담당)
 * - 파생값은 저장하지 않고 여기서 계산한다. (개별 확률, 기대 연차, n회 내 확률)
 * - 확률은 내부적으로 0~1 실수로 다룬다. 공시값의 % 단위는 경계에서만 변환한다.
 *
 * 닫힌 식이 성립하는 근거 (기획서 3-2)
 * 10회차 보정은 ★1 그룹을 ★2로 옮길 뿐 ★3 확률은 1~9회차와 동일하다.
 * 따라서 ★3 목표는 매 연차가 독립 시행이며 `1 - (1-p)^n`이 그대로 성립한다.
 * 예외는 ★2 픽업(10연 블록 분기)과 차지 방식(반천장 분기) 두 가지뿐이다.
 *
 * 차지 방식 = 한국의 모집 스택 (2026-11-10~). 내부 이름은 charge로 통일한다.
 * - 스택이 반천장(100)이 되는 연차: ★3 확정, 픽업 확률 50% → 그 연차만 실패 확률이 0.5
 * - 스택이 천장(200)이 되는 연차: 픽업 확정 → 실패 확률 0
 * - 그 밖의 연차는 독립 시행 그대로. 그래서 닫힌 식에 두 항만 더하면 된다
 * - 모집 마일리지의 10회 모집 티켓은 연차를 늘린다 (받은 티켓으로 뽑아도 마일리지가 쌓인다)
 */

// ---------------------------------------------------------------------------
// 확률 기본
// ---------------------------------------------------------------------------

/**
 * 그룹 전체 확률(%)과 풀 크기로 개별 대상 1회 확률(0~1)을 구한다.
 *
 * 저장된 `perUnitRate`는 공시 대조용 기록이므로 계산에는 쓰지 않는다.
 * 풀 크기는 학생 추가·아카이브 편입으로 계속 변하기 때문.
 */
export function perUnitRate(groupRatePercent: number, poolSize: number): number {
	if (poolSize <= 0) throw new Error('poolSize는 1 이상이어야 한다');
	if (groupRatePercent < 0) throw new Error('groupRate는 음수일 수 없다');
	return groupRatePercent / 100 / poolSize;
}

/**
 * n회 안에 최소 1회 획득할 확률: `1 - (1-p)^n`
 *
 * p가 작고 n이 클 때 `Math.pow(1-p, n)`은 자릿수를 잃는다.
 * log1p/expm1 쌍으로 계산해 p ≈ 0.007 구간에서도 정밀도를 유지한다.
 */
export function probAtLeastOne(p: number, pulls: number): number {
	assertProbability(p);
	if (pulls <= 0 || p === 0) return 0;
	if (p === 1) return 1;
	return -Math.expm1(pulls * Math.log1p(-p));
}

/**
 * 첫 획득까지의 기대 연차.
 *
 * - `pityCap` 없음: 기하분포 기대값 `1/p` (천장이 없다고 가정)
 * - `pityCap` 있음: 천장에서 잘린 기대값 `E[min(N, K)] = (1-(1-p)^K)/p`
 *
 * 실제 서비스가 보여줄 값은 후자다. 천장이 있으므로 200연을 넘겨 뽑는 일은 없다.
 * (수집 단계에서 이 구분을 놓쳐 109 vs 107.8 오차가 났다 — docs/002)
 */
export function expectedPulls(p: number, pityCap?: number): number {
	assertProbability(p);
	if (p === 0) return Infinity;
	if (pityCap === undefined) return 1 / p;
	if (pityCap <= 0) return 0;
	return -Math.expm1(pityCap * Math.log1p(-p)) / p;
}

export interface CurvePoint {
	pulls: number;
	probability: number;
}

/** 연차별 누적 확률 곡선. 그래프용이므로 step으로 점 개수를 줄일 수 있다. */
export function probabilityCurve(p: number, maxPulls: number, step = 1): CurvePoint[] {
	if (step <= 0) throw new Error('step은 1 이상이어야 한다');
	const points: CurvePoint[] = [];
	for (let n = 0; n <= maxPulls; n += step) {
		points.push({ pulls: n, probability: probAtLeastOne(p, n) });
	}
	// 마지막 점이 잘리면 끝값을 따로 넣는다 (곡선이 도중에 끊겨 보이지 않도록)
	if (points[points.length - 1]?.pulls !== maxPulls && maxPulls > 0) {
		points.push({ pulls: maxPulls, probability: probAtLeastOne(p, maxPulls) });
	}
	return points;
}

/**
 * ★2 픽업 목표 — 10연 블록 분기.
 *
 * 10회차에 ★2 그룹 확률이 18.5% → 97%로 뛰므로 독립 시행이 아니다.
 * 블록 내 위치를 따라가며 여사건을 곱한다.
 *
 * @param pullsIntoBlock 현재 10연 블록에서 이미 소비한 횟수 (0~9)
 */
export function probAtLeastOneTwoStar(params: {
	rateNormal: number;
	rateTenth: number;
	pulls: number;
	pullsIntoBlock?: number;
}): number {
	const { rateNormal, rateTenth, pulls, pullsIntoBlock = 0 } = params;
	assertProbability(rateNormal);
	assertProbability(rateTenth);
	if (pulls <= 0) return 0;

	let missProbability = 1;
	let position = ((pullsIntoBlock % 10) + 10) % 10;
	for (let i = 0; i < pulls; i++) {
		missProbability *= 1 - (position === 9 ? rateTenth : rateNormal);
		position = (position + 1) % 10;
	}
	return 1 - missProbability;
}

// ---------------------------------------------------------------------------
// 재화 → 연차
// ---------------------------------------------------------------------------

export interface PullBudgetInput {
	/** 보유 청휘석 */
	gems: number;
	/** 1회 모집권 */
	singleTickets?: number;
	/** 10회 모집권 */
	tenPullTickets?: number;
	/** 1회 모집 비용 (ko 기준 120) */
	costPerPull: number;
	/** 10회 모집 비용. 기본값은 할인 없음(costPerPull × 10) */
	costPerTenPull?: number;
}

export interface PullBudget {
	fromGems: number;
	fromTickets: number;
	/**
	 * 보유분을 쓰는 동안 모집 마일리지로 받는 10회 모집 티켓의 연차 (스택 방식만, 그 밖에는 0).
	 * total에 포함된다.
	 */
	fromMileage: number;
	total: number;
	/** 연차로 바꾸지 못하고 남는 청휘석 */
	leftoverGems: number;
}

/**
 * 보유 재화를 최대 연차 수로 환산한다.
 *
 * 현재 ko는 10회가 1200으로 할인이 없지만, 할인이 생겨도 식을 고치지 않도록
 * 10연 단가가 더 싼 경우 10연을 먼저 채우는 방식으로 둔다.
 */
export function pullBudget(input: PullBudgetInput): PullBudget {
	const {
		gems,
		singleTickets = 0,
		tenPullTickets = 0,
		costPerPull,
		costPerTenPull = costPerPull * 10
	} = input;
	if (costPerPull <= 0) throw new Error('costPerPull은 1 이상이어야 한다');
	if (gems < 0) throw new Error('보유 청휘석은 음수일 수 없다');

	let remaining = gems;
	let fromGems = 0;

	if (costPerTenPull / 10 < costPerPull) {
		const blocks = Math.floor(remaining / costPerTenPull);
		fromGems += blocks * 10;
		remaining -= blocks * costPerTenPull;
	}
	const singles = Math.floor(remaining / costPerPull);
	fromGems += singles;
	remaining -= singles * costPerPull;

	const fromTickets = singleTickets + tenPullTickets * 10;
	return {
		fromGems,
		fromTickets,
		fromMileage: 0,
		total: fromGems + fromTickets,
		leftoverGems: remaining
	};
}

// ---------------------------------------------------------------------------
// 모집 마일리지 (스택 방식)
// ---------------------------------------------------------------------------

export interface MileageInput {
	/** 이번 모집 기간에 이미 쌓인 마일리지 */
	current: number;
	/** 10회 모집 티켓을 받는 누적 마일리지 (오름차순) */
	ticketAt: readonly number[];
	/** 티켓 1장으로 하는 연차 (10회 모집 티켓 → 10) */
	pullsPerTicket: number;
	/** 1회당 적립. 기본 1 */
	perPull?: number;
}

/** pulls연을 하는 동안 받는 티켓 장수. 지금 마일리지 초과 ~ 모집 후 마일리지 이하의 기준을 센다. */
export function mileageTicketsEarned(m: MileageInput, pulls: number): number {
	const perPull = m.perPull ?? 1;
	const from = m.current;
	const to = m.current + Math.max(0, pulls) * perPull;
	return m.ticketAt.filter((t) => t > from && t <= to).length;
}

/**
 * 재화로 할 수 있는 연차(basePulls)를 다 쓰는 동안 받는 티켓까지 더한 총 연차.
 * 받은 티켓으로 뽑아도 마일리지가 쌓이므로, 더 늘지 않을 때까지 반복한다 (티켓이 유한해 끝난다).
 * 마지막 연차에 받은 티켓도 이어서 쓸 수 있으므로 포함한다.
 */
export function pullsWithMileage(basePulls: number, m?: MileageInput): number {
	if (!m || basePulls <= 0) return Math.max(0, basePulls);
	let total = basePulls;
	for (;;) {
		const next = basePulls + mileageTicketsEarned(m, total) * m.pullsPerTicket;
		if (next === total) return total;
		total = next;
	}
}

/**
 * target연을 채우려면 청휘석으로 몇 연을 해야 하는가.
 * 보유 티켓(ticketPulls)을 먼저 쓰고, 모집하며 받은 티켓은 받는 즉시 쓴다.
 * target연째에 받은 티켓은 이 목표에는 쓰이지 않는다(남는다).
 *
 * 한 연차씩 진행하는 짧은 루프(최대 천장 200회)라 닫힌 식보다 규칙이 그대로 드러난다.
 */
export function gemPullsToReach(
	target: number,
	ticketPulls: number,
	m?: MileageInput
): { gemPulls: number; earnedTicketPulls: number } {
	const perPull = m?.perPull ?? 1;
	const thresholds = new Set(m?.ticketAt ?? []);
	let tickets = Math.max(0, ticketPulls);
	let mileage = m?.current ?? 0;
	let gemPulls = 0;
	let earned = 0;
	for (let i = 0; i < target; i++) {
		if (tickets > 0) tickets -= 1;
		else gemPulls += 1;
		if (!m) continue;
		for (let k = 0; k < perPull; k++) {
			mileage += 1;
			if (thresholds.has(mileage)) {
				tickets += m.pullsPerTicket;
				earned += m.pullsPerTicket;
			}
		}
	}
	return { gemPulls, earnedTicketPulls: earned };
}

// ---------------------------------------------------------------------------
// 스택(차지) 방식 확률
// ---------------------------------------------------------------------------

/** 스택 규칙. 값은 game-config.json chargeSystem에서 어댑터가 넘긴다 */
export interface ChargeRule {
	/** 반천장 (한국 100) */
	half: number;
	/** 반천장 연차에 픽업이 나올 확률 (한국 0.5) */
	halfPickupChance: number;
	/** 천장 (한국 200) */
	full: number;
	/** 1회당 스택. 기본 1 */
	perPull?: number;
}

function chargeGaps(currentCharge: number, rule: ChargeRule) {
	const perPull = rule.perPull ?? 1;
	if (currentCharge < 0 || currentCharge >= rule.full) {
		throw new Error(`스택은 0 이상 ${rule.full} 미만이어야 한다 (받은 값: ${currentCharge})`);
	}
	return {
		/** 천장 연차 — 이 연차에 픽업 확정 */
		full: gapToThreshold(currentCharge, rule.full, perPull),
		/** 반천장 연차. 이미 지났으면(스택 ≥ 반천장) null */
		half: currentCharge < rule.half ? gapToThreshold(currentCharge, rule.half, perPull) : null
	};
}

/**
 * 스택 방식에서 pulls연 안에 픽업을 최소 1회 얻을 확률.
 * 반천장 연차는 실패 확률 (1 - halfPickupChance), 천장 연차에 도달하면 1.
 * 이미 반천장을 지난 스택(이전 기간에서 이월)은 천장만 남는다.
 */
export function chargeProbAtLeastOne(
	p: number,
	currentCharge: number,
	pulls: number,
	rule: ChargeRule
): number {
	assertProbability(p);
	assertProbability(rule.halfPickupChance);
	const gap = chargeGaps(currentCharge, rule);
	if (pulls <= 0) return 0;
	if (pulls >= gap.full) return 1;
	const halfInRange = gap.half !== null && gap.half <= pulls;
	const normalPulls = pulls - (halfInRange ? 1 : 0);
	const missNormal = normalPulls > 0 ? Math.exp(normalPulls * Math.log1p(-p)) : 1;
	const missHalf = halfInRange ? 1 - rule.halfPickupChance : 1;
	return 1 - missNormal * missHalf;
}

/**
 * 스택 방식의 첫 픽업까지 기대 연차 (천장에서 잘림). 생존 확률의 합.
 * 화면에는 쓰지 않는다(평균 소비 비표시 결정). 플래너 기대값 검토용.
 */
export function chargeExpectedPulls(p: number, currentCharge: number, rule: ChargeRule): number {
	const gap = chargeGaps(currentCharge, rule);
	let expected = 0;
	for (let k = 0; k < gap.full; k++) {
		expected += 1 - chargeProbAtLeastOne(p, currentCharge, k, rule);
	}
	return expected;
}

/**
 * 스택 방식 확률 곡선. 반천장·천장에서 계단처럼 뛴다.
 * step이 1보다 커도 계단 앞뒤 점(반천장-1, 반천장, 천장-1, 천장)은 반드시 넣는다.
 */
export function chargeProbabilityCurve(
	p: number,
	currentCharge: number,
	maxPulls: number,
	rule: ChargeRule,
	step = 1
): CurvePoint[] {
	if (step <= 0) throw new Error('step은 1 이상이어야 한다');
	const gap = chargeGaps(currentCharge, rule);
	const xs = new Set<number>();
	for (let n = 0; n <= maxPulls; n += step) xs.add(n);
	for (const n of [gap.half, gap.full]) {
		if (n === null) continue;
		if (n - 1 >= 0 && n - 1 <= maxPulls) xs.add(n - 1);
		if (n <= maxPulls) xs.add(n);
	}
	if (maxPulls > 0) xs.add(maxPulls);
	return [...xs]
		.sort((a, b) => a - b)
		.map((n) => ({ pulls: n, probability: chargeProbAtLeastOne(p, currentCharge, n, rule) }));
}

// ---------------------------------------------------------------------------
// 천장
// ---------------------------------------------------------------------------

export type PitySystem = 'point_exchange' | 'charge';

export interface PointPityInput {
	system: 'point_exchange';
	/** 해당 풀의 현재 모집 포인트 */
	currentPoints: number;
	/** 교환에 필요한 포인트 (ko recruit 기준 200) */
	pityThreshold: number;
	availablePulls: number;
	costPerPull: number;
	/** 1회당 적립 포인트. 기본 1 */
	pointsPerPull?: number;
}

export interface PointPityResult {
	system: 'point_exchange';
	reachable: boolean;
	/** 교환까지 더 필요한 연차 */
	pullsToPity: number;
	/** 보유분으로 모자라는 연차 */
	shortfallPulls: number;
	/**
	 * 모자라는 연차 × 1회 비용. 자투리 청휘석은 반영하지 않는다.
	 * 화면에 보여줄 값은 Verdict의 shortfallGems를 쓴다.
	 */
	shortfallGems: number;
	/** 보유분을 전부 소비했을 때의 포인트 (교환 시 차감은 반영하지 않음) */
	pointsAfterAllPulls: number;
}

export interface ChargePityInput {
	system: 'charge';
	currentCharge: number;
	/** 반천장 (일본 현행 100) */
	halfThreshold: number;
	/** 천장 (일본 현행 200) */
	fullThreshold: number;
	availablePulls: number;
	costPerPull: number;
	chargePerPull?: number;
	/** 반천장 연차의 픽업 확률. 판정·확률 계산(evaluatePickup)에 필요 */
	halfPickupChance?: number;
	/** 모집 마일리지. 없으면 티켓을 받지 않는다고 본다 */
	mileage?: MileageInput;
}

export interface ChargePityResult {
	system: 'charge';
	half: { reachable: boolean; pullsTo: number; shortfallPulls: number; shortfallGems: number };
	full: { reachable: boolean; pullsTo: number; shortfallPulls: number; shortfallGems: number };
	chargeAfterAllPulls: number;
}

export type PityResult = PointPityResult | ChargePityResult;

/**
 * 천장 도달 여부와 부족분을 계산한다.
 *
 * 두 방식의 차이는 리셋 조건이지만(포인트는 픽업 획득해도 유지, 차지는 리셋),
 * "지금부터 천장까지 얼마가 더 필요한가"는 현재 보유값에서 출발하므로 같은 꼴이다.
 * 리셋 규칙은 여러 배너를 이어 계산하는 플래너 쪽에서 다룬다.
 *
 * 차지 방식의 shortfallGems는 마일리지 티켓을 반영하지 않은 단순 곱이다.
 * 화면에 보여줄 부족분은 chargeVerdict가 정본이다.
 */
export function evaluatePity(input: PointPityInput): PointPityResult;
export function evaluatePity(input: ChargePityInput): ChargePityResult;
export function evaluatePity(input: PointPityInput | ChargePityInput): PityResult {
	if (input.system === 'point_exchange') {
		const { currentPoints, pityThreshold, availablePulls, costPerPull, pointsPerPull = 1 } = input;
		const gap = gapToThreshold(currentPoints, pityThreshold, pointsPerPull);
		const shortfallPulls = Math.max(0, gap - availablePulls);
		return {
			system: 'point_exchange',
			reachable: shortfallPulls === 0,
			pullsToPity: gap,
			shortfallPulls,
			shortfallGems: shortfallPulls * costPerPull,
			pointsAfterAllPulls: currentPoints + availablePulls * pointsPerPull
		};
	}

	const {
		currentCharge,
		halfThreshold,
		fullThreshold,
		availablePulls,
		costPerPull,
		chargePerPull = 1
	} = input;
	const leg = (threshold: number) => {
		const gap = gapToThreshold(currentCharge, threshold, chargePerPull);
		const shortfallPulls = Math.max(0, gap - availablePulls);
		return {
			reachable: shortfallPulls === 0,
			pullsTo: gap,
			shortfallPulls,
			shortfallGems: shortfallPulls * costPerPull
		};
	};
	return {
		system: 'charge',
		half: leg(halfThreshold),
		full: leg(fullThreshold),
		chargeAfterAllPulls: currentCharge + availablePulls * chargePerPull
	};
}

function gapToThreshold(current: number, threshold: number, perPull: number): number {
	if (perPull <= 0) throw new Error('1회당 적립량은 1 이상이어야 한다');
	return Math.max(0, Math.ceil((threshold - current) / perPull));
}

// ---------------------------------------------------------------------------
// 판정
// ---------------------------------------------------------------------------

/**
 * 결과 카드의 분기. 화면은 kind로 메시지 키를 고르고, 숫자만 채운다.
 *
 * 포인트 방식에서 헤드라인은 "획득 확률"이 아니라 천장 도달 여부다.
 * 천장에 닿으면 교환으로 확정 획득이므로, `1-(1-p)^n`은
 * "천장 전에 뽑기로 나올 확률"이라는 보조 정보로 내려간다.
 *
 * 평균 소비 청휘석은 화면에 쓰지 않는다 (2026-09-22 결정).
 * 한 번 뽑는 사용자가 실제로 겪는 값이 아니기 때문. 단 expectedPulls는
 * 플래너의 기대값 모드에서 쓰이므로 계산 함수는 유지한다.
 */
export type Verdict =
	/** 이미 교환 가능한 포인트가 있다 */
	| { kind: 'exchange_now' }
	/** 보유분으로 천장까지 닿는다 */
	| {
			kind: 'guaranteed';
			pullsToPity: number;
			/** 천장에 닿기 전(천장에 닿는 마지막 뽑기 포함) 뽑기로 나올 확률 */
			probabilityBeforePity: number;
			/** 천장까지 뽑아도 남는 청휘석. 모집권을 먼저 쓴다고 가정 */
			leftoverGemsAtPity: number;
	  }
	/** 천장까지 모자란다 */
	| {
			kind: 'short';
			pullsToPity: number;
			/**
			 * 보유분을 전부 썼을 때 획득 확률.
			 * 보유분이 0이면 null — 화면은 확률 칸을 숨기고 부족분만 보여준다 (2026-09-22 결정)
			 */
			probability: number | null;
			shortfallPulls: number;
			shortfallGems: number;
			/** 스택 방식만: 다 쓰고 못 얻었을 때 이월되는 스택 (포인트 방식은 이월 없음) */
			chargeIfMissed?: number;
			/** 스택 방식만: 반천장까지 모자란 청휘석. 반천장을 이미 지났으면 없음 */
			halfShortfallGems?: number;
	  }
	/** 스택 방식 — 반천장까지는 닿지만 천장에는 모자란다 */
	| {
			kind: 'half_reachable';
			pullsToHalf: number;
			pullsToPity: number;
			/** 보유분을 전부 썼을 때 획득 확률 (반천장의 50% 포함) */
			probability: number;
			shortfallPulls: number;
			shortfallGems: number;
			/** 보유분을 다 쓰고도 픽업이 안 나왔을 때 다음 모집으로 넘어가는 스택 */
			chargeIfMissed: number;
	  };

export interface PointVerdictInput {
	gems: number;
	/** 모집권으로 할 수 있는 연차 (1회권 + 10회권 × 10) */
	ticketPulls: number;
	costPerPull: number;
	/** 보유 재화로 가능한 총 연차 */
	availablePulls: number;
	pullsToPity: number;
	targetRate: number;
}

export function pointVerdict(input: PointVerdictInput): Verdict {
	const { gems, ticketPulls, costPerPull, availablePulls, pullsToPity, targetRate } = input;

	if (pullsToPity <= 0) return { kind: 'exchange_now' };

	// 모집권을 먼저 쓰고, 나머지를 청휘석으로 채운다.
	// 남는 청휘석과 부족한 청휘석을 같은 식의 양쪽으로 계산하므로 둘이 어긋나지 않는다.
	// (10연 할인이 생기면 gemsNeeded 계산을 pullBudget과 같은 방식으로 바꿔야 한다)
	const gemsNeeded = Math.max(0, pullsToPity - ticketPulls) * costPerPull;

	if (gems >= gemsNeeded) {
		return {
			kind: 'guaranteed',
			pullsToPity,
			probabilityBeforePity: probAtLeastOne(targetRate, pullsToPity),
			leftoverGemsAtPity: gems - gemsNeeded
		};
	}

	return {
		kind: 'short',
		pullsToPity,
		probability: availablePulls > 0 ? probAtLeastOne(targetRate, availablePulls) : null,
		shortfallPulls: pullsToPity - availablePulls,
		// 연차로 바꾸지 못한 자투리 청휘석까지 반영한 "더 모아야 할 양"
		shortfallGems: gemsNeeded - gems
	};
}

export interface ChargeVerdictInput {
	gems: number;
	/** 보유 모집권 연차 (1회권 + 10회권 × 10) */
	ticketPulls: number;
	costPerPull: number;
	currentCharge: number;
	rule: ChargeRule;
	targetRate: number;
	mileage?: MileageInput;
}

/**
 * 스택 방식의 결과 카드 분기.
 * - guaranteed: 천장(200)까지 닿는다 → 확정
 * - half_reachable: 반천장(100)까지만 → 그때까지 나올 확률(50% 포함)과 천장까지 부족분
 * - short: 반천장에도 못 닿는다 (또는 반천장을 이미 지났고 천장에 모자람)
 * 부족한 청휘석은 마일리지 티켓을 받는다고 보고 계산한다 (gemPullsToReach).
 * 포인트 방식의 exchange_now는 없다 — 스택은 천장에 닿는 순간 자동으로 픽업이 나온다.
 */
export function chargeVerdict(input: ChargeVerdictInput): Verdict {
	const { gems, ticketPulls, costPerPull, currentCharge, rule, targetRate, mileage } = input;
	if (costPerPull <= 0) throw new Error('costPerPull은 1 이상이어야 한다');
	const gap = chargeGaps(currentCharge, rule);
	const gemsNeeded = (target: number) =>
		gemPullsToReach(target, ticketPulls, mileage).gemPulls * costPerPull;

	const gemsForFull = gemsNeeded(gap.full);
	if (gems >= gemsForFull) {
		return {
			kind: 'guaranteed',
			pullsToPity: gap.full,
			// 천장 연차는 확정이므로 "천장 전에"는 그 앞 연차까지
			probabilityBeforePity: chargeProbAtLeastOne(targetRate, currentCharge, gap.full - 1, rule),
			leftoverGemsAtPity: gems - gemsForFull
		};
	}

	const available = pullsWithMileage(Math.floor(gems / costPerPull) + ticketPulls, mileage);
	const perPull = rule.perPull ?? 1;
	const common = {
		pullsToPity: gap.full,
		shortfallPulls: gap.full - available,
		shortfallGems: gemsForFull - gems,
		chargeIfMissed: currentCharge + available * perPull
	};

	if (gap.half !== null) {
		const gemsForHalf = gemsNeeded(gap.half);
		if (gems >= gemsForHalf) {
			return {
				kind: 'half_reachable',
				pullsToHalf: gap.half,
				probability: chargeProbAtLeastOne(targetRate, currentCharge, available, rule),
				...common
			};
		}
		return {
			kind: 'short',
			probability:
				available > 0 ? chargeProbAtLeastOne(targetRate, currentCharge, available, rule) : null,
			halfShortfallGems: gemsForHalf - gems,
			...common
		};
	}
	return {
		kind: 'short',
		probability:
			available > 0 ? chargeProbAtLeastOne(targetRate, currentCharge, available, rule) : null,
		...common
	};
}

// ---------------------------------------------------------------------------
// 화면이 쓰는 묶음 함수
// ---------------------------------------------------------------------------

export interface PickupEvaluationInput {
	budget: PullBudgetInput;
	/** 목표 대상 1회 확률 (perUnitRate로 계산해 전달) */
	targetRate: number;
	pity:
		| Omit<PointPityInput, 'availablePulls' | 'costPerPull'>
		| (Omit<ChargePityInput, 'availablePulls' | 'costPerPull'> & { halfPickupChance: number });
	/** 곡선 점 간격. 기본 1 */
	curveStep?: number;
}

export interface PickupEvaluation {
	budget: PullBudget;
	/** 보유분을 전부 소비했을 때의 획득 확률 */
	probability: number;
	/** 천장에서 잘린 기대 연차 — 화면에 보여줄 값 */
	expectedPulls: number;
	/** 천장을 무시한 기대 연차 — 비교용 */
	expectedPullsUncapped: number;
	pity: PityResult;
	/** 결과 카드 분기 */
	verdict: Verdict;
	curve: CurvePoint[];
}

/** 기획서 3-2의 출력 항목을 한 번에 만든다. */
export function evaluatePickup(input: PickupEvaluationInput): PickupEvaluation {
	const costPerPull = input.budget.costPerPull;
	const p = input.targetRate;
	const step = input.curveStep ?? 1;

	if (input.pity.system === 'point_exchange') {
		const budget = pullBudget(input.budget);
		const pity = evaluatePity({ ...input.pity, availablePulls: budget.total, costPerPull });
		return {
			budget,
			pity,
			verdict: pointVerdict({
				gems: input.budget.gems,
				ticketPulls: budget.fromTickets,
				costPerPull,
				availablePulls: budget.total,
				pullsToPity: pity.pullsToPity,
				targetRate: p
			}),
			probability: probAtLeastOne(p, budget.total),
			expectedPulls: expectedPulls(p, pity.pullsToPity),
			expectedPullsUncapped: expectedPulls(p),
			curve: probabilityCurve(p, Math.max(budget.total, pity.pullsToPity), step)
		};
	}

	// 스택(차지) 방식
	const c = input.pity;
	const rule: ChargeRule = {
		half: c.halfThreshold,
		halfPickupChance: c.halfPickupChance,
		full: c.fullThreshold,
		perPull: c.chargePerPull
	};
	const base = pullBudget(input.budget);
	const total = pullsWithMileage(base.total, c.mileage);
	const budget: PullBudget = { ...base, fromMileage: total - base.total, total };
	const pity = evaluatePity({ ...c, availablePulls: total, costPerPull });

	return {
		budget,
		pity,
		verdict: chargeVerdict({
			gems: input.budget.gems,
			ticketPulls: base.fromTickets,
			costPerPull,
			currentCharge: c.currentCharge,
			rule,
			targetRate: p,
			mileage: c.mileage
		}),
		probability: chargeProbAtLeastOne(p, c.currentCharge, total, rule),
		expectedPulls: chargeExpectedPulls(p, c.currentCharge, rule),
		expectedPullsUncapped: expectedPulls(p),
		curve: chargeProbabilityCurve(
			p,
			c.currentCharge,
			Math.max(total, pity.full.pullsTo),
			rule,
			step
		)
	};
}

// ---------------------------------------------------------------------------

function assertProbability(p: number): void {
	if (!Number.isFinite(p) || p < 0 || p > 1) {
		throw new Error(`확률은 0~1 사이여야 한다 (받은 값: ${p})`);
	}
}
