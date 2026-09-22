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
		total: fromGems + fromTickets,
		leftoverGems: remaining
	};
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
	/** 모자라는 연차를 채우는 데 필요한 청휘석 */
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
// 화면이 쓰는 묶음 함수
// ---------------------------------------------------------------------------

export interface PickupEvaluationInput {
	budget: PullBudgetInput;
	/** 목표 대상 1회 확률 (perUnitRate로 계산해 전달) */
	targetRate: number;
	pity:
		| Omit<PointPityInput, 'availablePulls' | 'costPerPull'>
		| Omit<ChargePityInput, 'availablePulls' | 'costPerPull'>;
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
	curve: CurvePoint[];
}

/** 기획서 3-2의 출력 항목을 한 번에 만든다. */
export function evaluatePickup(input: PickupEvaluationInput): PickupEvaluation {
	const budget = pullBudget(input.budget);
	const costPerPull = input.budget.costPerPull;

	const pity =
		input.pity.system === 'point_exchange'
			? evaluatePity({ ...input.pity, availablePulls: budget.total, costPerPull })
			: evaluatePity({ ...input.pity, availablePulls: budget.total, costPerPull });

	const pityCap =
		pity.system === 'point_exchange' ? pity.pullsToPity : pity.full.pullsTo;

	return {
		budget,
		probability: probAtLeastOne(input.targetRate, budget.total),
		expectedPulls: expectedPulls(input.targetRate, pityCap),
		expectedPullsUncapped: expectedPulls(input.targetRate),
		pity,
		curve: probabilityCurve(
			input.targetRate,
			Math.max(budget.total, pityCap),
			input.curveStep ?? 1
		)
	};
}

// ---------------------------------------------------------------------------

function assertProbability(p: number): void {
	if (!Number.isFinite(p) || p < 0 || p > 1) {
		throw new Error(`확률은 0~1 사이여야 한다 (받은 값: ${p})`);
	}
}
