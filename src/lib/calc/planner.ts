/**
 * 픽업 플래너 계산 (docs/005 7장). 순수 함수 — JSON·날짜 문자열을 모른다.
 *
 * 질문: 고른 학생들을 지금 재화와 앞으로의 수급으로, 우선순위대로 몇 명까지 확정으로 데려올 수 있나.
 *
 * 규칙 (v0.2)
 * - 모집 스택 방식만. 목표는 "확정(천장까지)" 하나 — 계획은 최악의 경우, 모든 목표가 천장에서 나온다고 세운다
 * - 스택은 종류마다 따로. 종류의 첫 목표는 지금 스택에서, 그 뒤 목표는 0에서 시작한다 (천장에서 얻으면 초기화)
 * - 넘긴 픽업에서는 뽑지 않으므로 스택은 그대로 이월된다
 * - 마일리지는 기간마다 새로 (지금 진행 중인 기간만 현재 마일리지에서). 받은 티켓은 그 기간에 먼저 쓴다(기간제)
 * - 뽑는 날은 기간의 마지막 날 — 그 기간 동안 받는 수급까지 쓸 수 있다
 * - 청휘석을 쓰면 그 뒤 모든 날의 잔고가 줄어든다. 그래서 "쓰는 날 이후 가장 낮은 잔고"와 비교한다
 *
 * 우선순위 계획(plan)은 1순위부터 하나씩 넣어 보고, 넣어도 앞선 목표가 모두 유지될 때만 남긴다.
 * 대안(alternatives)은 포함/제외 조합을 전수 탐색해 더 많이 확보하는 조합을 찾는다.
 */

import { chargeProbAtLeastOne, type ChargeRule } from './gacha';

export interface PlannerBanner {
	/** 이 배너가 쌓는 스택 종류 (ChargeType id) */
	stackType: string;
}

export interface PlannerPeriod {
	id: string;
	/** 0 = 오늘. 음수면 이미 시작한 기간 */
	startDay: number;
	/** 끝나는 날(그날은 포함하지 않음). 마지막으로 뽑을 수 있는 날 = endDay - 1 */
	endDay: number;
}

export interface PlannerTarget {
	/** 화면이 가리키는 이름 (학생 id 등) */
	id: string;
	periodId: string;
	stackType: string;
	/** 1회 획득 확률 (0~1). 모르면 null — 천장 전 확률을 비운다 */
	rate: number | null;
}

export interface PlannerInput {
	/** 기간 목록 (시작일 오름차순) */
	periods: PlannerPeriod[];
	/** 목표 — 배열 순서가 우선순위 (0이 1순위) */
	targets: PlannerTarget[];
	/**
	 * day일이 끝났을 때의 청휘석 잔고 (보유 + 수급 − AP 구매). 0 = 오늘.
	 * 수급 계산기가 만든 값을 그대로 넘긴다. 마지막 기간의 끝까지 있어야 한다
	 */
	gemsByDay: number[];
	/** day일까지 가진 모집 티켓의 누적 연차 (보유 + 수급으로 받는 10회 모집 티켓 × 10) */
	ticketPullsByDay: number[];
	/** 종류별 지금 스택 */
	stacks: Record<string, number>;
	/** 지금 진행 중인 기간의 모집 마일리지 */
	currentMileage: number;
	rule: ChargeRule;
	mileage: { ticketAt: readonly number[]; pullsPerTicket: number };
	costPerPull: number;
	/** 늘 남겨 둘 청휘석 */
	reserveGems?: number;
}

export interface PeriodSpend {
	periodId: string;
	/** 뽑는 날 (기간 마지막 날, 오늘보다 앞이면 오늘) */
	day: number;
	/** 이 기간에 확정으로 데려오는 목표 */
	targetIds: string[];
	/** 최악의 경우 이 기간에 하는 모집 횟수 */
	pulls: number;
	gemPulls: number;
	/** 가진 티켓으로 한 연차 */
	ticketPulls: number;
	/** 마일리지로 받은 티켓으로 한 연차 */
	mileagePulls: number;
	/** 뽑는 날 잔고 — 쓰기 전 / 쓴 뒤 */
	gemsBefore: number;
	gemsAfter: number;
}

export type TargetOutcome =
	| {
			kind: 'secured';
			id: string;
			periodId: string;
			stackStart: number;
			pullsToPity: number;
			/** 천장 전(199연까지)에 나올 확률 */
			probabilityBeforePity: number | null;
	  }
	| {
			kind: 'short';
			id: string;
			periodId: string;
			stackStart: number;
			pullsToPity: number;
			probabilityBeforePity: number | null;
			/** 계획에 이 목표를 더하려면 모자란 청휘석 */
			shortfallGems: number;
	  }
	| {
			kind: 'unavailable';
			id: string;
			periodId: string;
			reason: 'period_ended' | 'unknown_period';
	  };

export interface Alternative {
	/** 확보하는 목표 id (우선순위 순) */
	securedIds: string[];
	/** 우선순위 계획에서 빠지는 목표 */
	droppedIds: string[];
	/** 우선순위 계획에 없던 목표 */
	gainedIds: string[];
}

export interface PlannerResult {
	outcomes: TargetOutcome[];
	securedCount: number;
	periods: PeriodSpend[];
	/** 계획대로 했을 때 날짜별 잔고 (gemsByDay에서 지출을 뺀 값) */
	balance: number[];
	/** 더 많이 확보하는 조합, 최대 2개. 목표가 많으면(ALTERNATIVE_LIMIT 초과) 계산하지 않는다 */
	alternatives: Alternative[];
}

/** 대안 전수 탐색의 상한. 2^12 = 4,096 조합 */
export const ALTERNATIVE_LIMIT = 12;

// ---------------------------------------------------------------------------

/**
 * 한 기간에 pulls연을 할 때 청휘석으로 하는 연차.
 * 마일리지로 받은 티켓(기간제)을 먼저, 그다음 가진 티켓, 마지막에 청휘석.
 */
export function spendInPeriod(
	pulls: number,
	ownedTicketPulls: number,
	startMileage: number,
	mileage: PlannerInput['mileage']
): { gemPulls: number; ticketPulls: number; mileagePulls: number } {
	const thresholds = new Set(mileage.ticketAt);
	let earned = 0;
	let owned = Math.max(0, ownedTicketPulls);
	let m = startMileage;
	let gemPulls = 0;
	let ticketPulls = 0;
	let mileagePulls = 0;
	for (let i = 0; i < pulls; i++) {
		if (earned > 0) {
			earned -= 1;
			mileagePulls += 1;
		} else if (owned > 0) {
			owned -= 1;
			ticketPulls += 1;
		} else gemPulls += 1;
		m += 1;
		if (thresholds.has(m)) earned += mileage.pullsPerTicket;
	}
	return { gemPulls, ticketPulls, mileagePulls };
}

/** 오늘부터 끝까지, 각 날 이후 가장 낮은 잔고 */
function suffixMin(values: number[]): number[] {
	const out = new Array<number>(values.length);
	let min = Infinity;
	for (let i = values.length - 1; i >= 0; i--) {
		min = Math.min(min, values[i]);
		out[i] = min;
	}
	return out;
}

interface Evaluation {
	/** 계획대로 하려면 모자란 청휘석 (0이면 가능) */
	deficit: number;
	periods: PeriodSpend[];
	/** 목표 id → 그 목표를 시작할 때의 스택 */
	stackStart: Map<string, number>;
	spendByDay: Map<number, number>;
}

function spendDay(p: PlannerPeriod): number {
	return Math.max(0, p.endDay - 1);
}

/** 목표 묶음(인덱스)을 모두 확정으로 데려오는 최악의 경우를 날짜순으로 따라간다 */
function evaluateSet(input: PlannerInput, chosen: number[], minAfter: number[]): Evaluation {
	const reserve = input.reserveGems ?? 0;
	const lastDay = input.gemsByDay.length - 1;
	const byPeriod = new Map<string, number[]>();
	for (const i of chosen) {
		const pid = input.targets[i].periodId;
		byPeriod.set(pid, [...(byPeriod.get(pid) ?? []), i]);
	}

	const stacks = { ...input.stacks };
	const stackStart = new Map<string, number>();
	const spendByDay = new Map<number, number>();
	const periods: PeriodSpend[] = [];
	let gemsSpent = 0;
	let ticketsUsed = 0;
	let deficit = 0;

	for (const period of input.periods) {
		const idx = byPeriod.get(period.id);
		if (!idx) continue;
		let pulls = 0;
		// 같은 기간 안에서는 우선순위 순서로 스택을 소비한다 (같은 종류 둘이면 두 번째는 0에서)
		for (const i of [...idx].sort((a, b) => a - b)) {
			const t = input.targets[i];
			const start = Math.min(stacks[t.stackType] ?? 0, input.rule.full - 1);
			stackStart.set(t.id, start);
			pulls += input.rule.full - start;
			stacks[t.stackType] = 0;
		}
		const day = Math.min(spendDay(period), lastDay);
		const ownedTickets = Math.max(0, (input.ticketPullsByDay[day] ?? 0) - ticketsUsed);
		const inProgress = period.startDay <= 0;
		const s = spendInPeriod(
			pulls,
			ownedTickets,
			inProgress ? input.currentMileage : 0,
			input.mileage
		);
		ticketsUsed += s.ticketPulls;
		const gems = s.gemPulls * input.costPerPull;
		const before = input.gemsByDay[day] - gemsSpent;
		gemsSpent += gems;
		spendByDay.set(day, (spendByDay.get(day) ?? 0) + gems);
		// 쓰는 날 이후 가장 낮은 잔고가 남겨 둘 청휘석 아래로 내려가면 모자란다
		deficit = Math.max(deficit, gemsSpent + reserve - minAfter[day]);
		periods.push({
			periodId: period.id,
			day,
			targetIds: idx.sort((a, b) => a - b).map((i) => input.targets[i].id),
			pulls,
			gemPulls: s.gemPulls,
			ticketPulls: s.ticketPulls,
			mileagePulls: s.mileagePulls,
			gemsBefore: before,
			gemsAfter: before - gems
		});
	}
	return { deficit: Math.max(0, deficit), periods, stackStart, spendByDay };
}

/** 목표가 계획할 수 있는 기간에 있는가 */
function availability(input: PlannerInput, t: PlannerTarget): TargetOutcome | null {
	const period = input.periods.find((p) => p.id === t.periodId);
	if (!period)
		return { kind: 'unavailable', id: t.id, periodId: t.periodId, reason: 'unknown_period' };
	if (period.endDay <= 0)
		return { kind: 'unavailable', id: t.id, periodId: t.periodId, reason: 'period_ended' };
	return null;
}

function beforePity(t: PlannerTarget, stackStart: number, rule: ChargeRule): number | null {
	if (t.rate === null) return null;
	return chargeProbAtLeastOne(t.rate, stackStart, rule.full - stackStart - 1, rule);
}

export function planPickups(input: PlannerInput): PlannerResult {
	if (input.gemsByDay.length === 0) throw new Error('gemsByDay가 비어 있다');
	if (input.costPerPull <= 0) throw new Error('costPerPull은 1 이상이어야 한다');
	const minAfter = suffixMin(input.gemsByDay);
	const n = input.targets.length;
	const usable = input.targets.map((t) => availability(input, t) === null);

	// 1. 우선순위 계획
	const plan: number[] = [];
	for (let i = 0; i < n; i++) {
		if (usable[i] && evaluateSet(input, [...plan, i], minAfter).deficit === 0) plan.push(i);
	}
	const planned = evaluateSet(input, plan, minAfter);

	// 2. 목표별 결과. 못 넣은 목표는 "완성된 계획에 이 목표를 더하면" 기준 — 스택 시작값과 모자란 청휘석 모두
	const outcomes: TargetOutcome[] = input.targets.map((t, i) => {
		const unavailable = availability(input, t);
		if (unavailable) return unavailable;
		const inPlan = plan.includes(i);
		const ev = inPlan ? planned : evaluateSet(input, [...plan, i], minAfter);
		const stackStart = ev.stackStart.get(t.id) ?? 0;
		const common = {
			id: t.id,
			periodId: t.periodId,
			stackStart,
			pullsToPity: input.rule.full - stackStart,
			probabilityBeforePity: beforePity(t, stackStart, input.rule)
		};
		return inPlan
			? { kind: 'secured', ...common }
			: { kind: 'short', ...common, shortfallGems: ev.deficit };
	});

	// 3. 날짜별 잔고
	const balance: number[] = [];
	let spent = 0;
	for (let d = 0; d < input.gemsByDay.length; d++) {
		spent += planned.spendByDay.get(d) ?? 0;
		balance.push(input.gemsByDay[d] - spent);
	}

	return {
		outcomes,
		securedCount: plan.length,
		periods: planned.periods,
		balance,
		alternatives: findAlternatives(input, usable, plan, minAfter)
	};
}

/**
 * 우선순위 계획보다 더 많이 확보하는 조합. 확보 수가 많은 순, 같으면 높은 우선순위를 지키는 순.
 * 우선순위 비교는 비트 가중치(1순위 = 가장 높은 비트)로 한다 — 1순위 하나가 아래 순위 전부보다 무겁다.
 */
function findAlternatives(
	input: PlannerInput,
	usable: boolean[],
	plan: number[],
	minAfter: number[]
): Alternative[] {
	const idx = usable.flatMap((u, i) => (u ? [i] : []));
	if (idx.length === 0 || idx.length > ALTERNATIVE_LIMIT) return [];
	const n = input.targets.length;
	const weight = (set: number[]) => set.reduce((w, i) => w + 2 ** (n - 1 - i), 0);
	const found: { set: number[]; weight: number }[] = [];
	for (let mask = 1; mask < 1 << idx.length; mask++) {
		const set = idx.filter((_, k) => mask & (1 << k));
		if (set.length <= plan.length) continue;
		if (evaluateSet(input, set, minAfter).deficit === 0) found.push({ set, weight: weight(set) });
	}
	found.sort((a, b) => b.set.length - a.set.length || b.weight - a.weight);
	const ids = (set: number[]) => set.map((i) => input.targets[i].id);
	return found.slice(0, 2).map(({ set }) => ({
		securedIds: ids(set),
		droppedIds: ids(plan.filter((i) => !set.includes(i))),
		gainedIds: ids(set.filter((i) => !plan.includes(i)))
	}));
}
