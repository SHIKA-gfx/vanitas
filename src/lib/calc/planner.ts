/**
 * 픽업 플래너 계산 (docs/005 7장). 순수 함수 — JSON·날짜 문자열을 모른다.
 *
 * 질문: 고른 학생들을 지금 재화와 앞으로의 수급으로, 우선순위대로 몇 명까지 확정으로 데려올 수 있나.
 *
 * 규칙 (v0.2, 목표 종류는 v0.3 — docs/007 10장)
 * - 모집 스택 방식만. 계획은 최악의 경우로 세운다 — 확정 목표는 천장에서 나오고,
 *   확률 목표(반천장까지·N연까지)는 정한 연 수를 다 쓰고 마지막 연에 나와 스택 0이 된다
 *   (청휘석도 같은 종류의 다음 목표도 가장 불리한 쪽). 확률 목표 자신의 결과만 확률로 말한다
 * - 스택은 종류마다 따로. 종류의 첫 목표는 지금 스택에서, 그 뒤 목표는 0에서 시작한다 (천장에서 얻으면 초기화)
 * - 넘긴 픽업에서는 뽑지 않으므로 스택은 그대로 이월된다
 * - 마일리지는 기간마다 새로 (지금 진행 중인 기간만 현재 마일리지에서). 받은 티켓은 그 기간에 먼저 쓴다(기간제)
 * - 뽑는 날은 기간의 마지막 날 — 그 기간 동안 받는 수급까지 쓸 수 있다
 * - 청휘석을 쓰면 그 뒤 모든 날의 잔고가 줄어든다. 그래서 "쓰는 날 이후 가장 낮은 잔고"와 비교한다
 *
 * 우선순위 계획(plan)은 1순위부터 하나씩 넣어 보고, 넣어도 앞선 목표가 모두 유지될 때만 남긴다.
 * 계획에 든 목표는 천장까지 쓰면 확보(secured), 정한 만큼만 쓰면 도전(attempt).
 * 못 넣은 목표의 부족 청휘석도 같은 묶음(앞 순위 계획 + 그 목표)으로 센다 — 뒤 순위 목표의 비용은 섞지 않는다.
 * 대안(alternatives)은 포함/제외 조합을 전수 탐색해 계획에 더 많이 드는(확보 + 도전) 조합을 찾는다.
 * 같은 묶음을 수급 조건만 바꿔 여러 번 다시 돌릴 때(부족분 메우기, planner-fill.ts)는 대안 탐색을 끈다.
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
	/**
	 * 이 기간에 쓸 수 있는 무료 모집 (스택·마일리지에 쌓인다, 2026-11-10).
	 * 이 기간 목표를 데려오는 데 먼저 쓴다. 목표를 데려오고 남는 무료 모집은 스택에 넣지 않는다 —
	 * 중간에 픽업이 나오면 스택이 초기화되므로 이월량을 장담할 수 없다. 목표가 없는 기간에는 쓰지 않은 것으로 본다
	 */
	freePulls?: number;
}

/**
 * 목표 종류 (docs/007 10장, 2026-11-15).
 * - pity  확정: 천장까지
 * - half  반천장까지: 시작 스택에서 반천장까지 (반천장 연차는 rule.halfPickupChance로 나온다)
 * - pulls N연까지: 정한 연 수만큼 (1 이상의 정수). 천장까지 남은 연 수 이상이면 확정과 같다
 */
export type PlannerGoal = { kind: 'pity' } | { kind: 'half' } | { kind: 'pulls'; pulls: number };

export type PlannerGoalKind = PlannerGoal['kind'];

export interface PlannerTarget {
	/** 화면이 가리키는 이름 (학생 id 등) */
	id: string;
	periodId: string;
	stackType: string;
	/** 1회 획득 확률 (0~1). 모르면 null — 확률을 비운다 */
	rate: number | null;
	/** 목표 종류. 없으면 확정 */
	goal?: PlannerGoal;
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
	/** 이 기간에 데려오는 목표 (확보·도전) */
	targetIds: string[];
	/** 최악의 경우 이 기간에 하는 모집 횟수 */
	pulls: number;
	gemPulls: number;
	/** 가진 티켓으로 한 연차 */
	ticketPulls: number;
	/** 마일리지로 받은 티켓으로 한 연차 */
	mileagePulls: number;
	/** 무료 모집으로 한 연차 */
	freePulls: number;
	/** 뽑는 날 잔고 — 쓰기 전 / 쓴 뒤 */
	gemsBefore: number;
	gemsAfter: number;
}

interface OutcomeBase {
	id: string;
	periodId: string;
	/** 고른 목표 종류 */
	goal: PlannerGoalKind;
	stackStart: number;
	pullsToPity: number;
	/** 이 목표에 쓰는 연 수 (확정은 pullsToPity, 확률 목표는 정한 만큼 — 천장까지 닿으면 pullsToPity) */
	pulls: number;
	/** pulls가 천장까지 닿는다 — 계획에 들면 확보, 아니면 도전 */
	guaranteed: boolean;
	/** pulls연 안에 나올 확률 (천장까지 닿으면 1) */
	probability: number | null;
	/** 천장 전(199연까지)에 나올 확률 */
	probabilityBeforePity: number | null;
}

export type TargetOutcome =
	/** 계획에 듦 — 천장까지 쓰는 목표 (확정, 또는 천장까지 닿는 N연) */
	| ({ kind: 'secured' } & OutcomeBase)
	/** 계획에 듦 — 정한 만큼만 쓰고 확률로 노리는 목표 (화면 "도전") */
	| ({ kind: 'attempt' } & OutcomeBase)
	| ({
			kind: 'short';
			/** 계획에 이 목표를 더하려면 모자란 청휘석 */
			shortfallGems: number;
	  } & OutcomeBase)
	| {
			kind: 'unavailable';
			id: string;
			periodId: string;
			/** half_passed: 반천장 목표인데 시작 스택이 이미 반천장 이상 — 뽑지 않는다 (넘기기와 같다) */
			reason: 'period_ended' | 'unknown_period' | 'half_passed';
	  };

/** 계획에 드는 결과 (확보 또는 도전) */
export const isPlanned = (o: TargetOutcome | undefined): boolean =>
	o?.kind === 'secured' || o?.kind === 'attempt';

export interface Alternative {
	/** 계획에 드는 목표 id (확보 + 도전, 우선순위 순) */
	plannedIds: string[];
	/** 우선순위 계획에서 빠지는 목표 */
	droppedIds: string[];
	/** 우선순위 계획에 없던 목표 */
	gainedIds: string[];
}

export interface PlannerResult {
	outcomes: TargetOutcome[];
	/** 확보 (secured) 수 */
	securedCount: number;
	/** 도전 (attempt) 수 */
	attemptCount: number;
	periods: PeriodSpend[];
	/** 계획대로 했을 때 날짜별 잔고 (gemsByDay에서 지출을 뺀 값) */
	balance: number[];
	/** 계획에 더 많이 드는 조합, 최대 2개. 목표가 많으면(ALTERNATIVE_LIMIT 초과) 계산하지 않는다 */
	alternatives: Alternative[];
}

/** 대안 전수 탐색의 상한. 2^12 = 4,096 조합 */
export const ALTERNATIVE_LIMIT = 12;

export interface PlanOptions {
	/**
	 * 대안 전수 탐색 (기본 켬). 끄면 alternatives는 빈 배열이다.
	 * 부족분 메우기처럼 수급 조건 수 × 목표 수만큼 다시 돌릴 때 끈다
	 */
	alternatives?: boolean;
}

// ---------------------------------------------------------------------------

/**
 * 한 기간에 pulls연을 할 때 청휘석으로 하는 연차.
 * 마일리지로 받은 티켓(기간제)을 먼저, 그다음 가진 티켓, 마지막에 청휘석.
 */
export function spendInPeriod(
	pulls: number,
	ownedTicketPulls: number,
	startMileage: number,
	mileage: PlannerInput['mileage'],
	freePulls = 0
): { gemPulls: number; ticketPulls: number; mileagePulls: number; freePulls: number } {
	const thresholds = new Set(mileage.ticketAt);
	let earned = 0;
	let owned = Math.max(0, ownedTicketPulls);
	let free = Math.max(0, freePulls);
	let m = startMileage;
	let gemPulls = 0;
	let ticketPulls = 0;
	let mileagePulls = 0;
	let freeUsed = 0;
	// 무료 모집 → 이 기간 마일리지 티켓(기간제) → 가진 티켓 → 청휘석 순. 어느 것이든 마일리지는 쌓인다
	for (let i = 0; i < pulls; i++) {
		if (free > 0) {
			free -= 1;
			freeUsed += 1;
		} else if (earned > 0) {
			earned -= 1;
			mileagePulls += 1;
		} else if (owned > 0) {
			owned -= 1;
			ticketPulls += 1;
		} else gemPulls += 1;
		m += 1;
		if (thresholds.has(m)) earned += mileage.pullsPerTicket;
	}
	return { gemPulls, ticketPulls, mileagePulls, freePulls: freeUsed };
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
	/** 목표 번호 → 그 목표를 시작할 때의 스택 */
	stackStart: Map<number, number>;
	/** 목표 번호 → 이 묶음에서 그 목표에 쓰는 연 수 */
	pullsOf: Map<number, number>;
	/** 이 묶음에서 반천장을 이미 지난 반천장 목표 — 뽑지 않고 스택을 그대로 넘긴다 */
	passed: Set<number>;
	spendByDay: Map<number, number>;
}

/**
 * 목표 종류와 시작 스택으로 그 목표에 쓰는 연 수 (docs/007 10-2).
 * 반천장 목표인데 시작 스택이 이미 반천장 이상이면 null — 뽑지 않는다
 */
export function goalPulls(
	goal: PlannerGoal | undefined,
	stackStart: number,
	rule: ChargeRule
): number | null {
	const toPity = rule.full - stackStart;
	if (!goal || goal.kind === 'pity') return toPity;
	if (goal.kind === 'half') return stackStart >= rule.half ? null : rule.half - stackStart;
	if (!Number.isInteger(goal.pulls) || goal.pulls < 1)
		throw new Error(`N연 목표의 연 수는 1 이상의 정수여야 한다: ${goal.pulls}`);
	return Math.min(goal.pulls, toPity);
}

function spendDay(p: PlannerPeriod): number {
	return Math.max(0, p.endDay - 1);
}

/**
 * 목표 묶음(인덱스)을 모두 데려오는 최악의 경우를 날짜순으로 따라간다.
 * 확정은 천장까지, 확률 목표는 정한 연 수를 다 쓰고, 어느 쪽이든 마지막 연에 나와 스택 0
 */
function evaluateSet(input: PlannerInput, chosen: number[], minAfter: number[]): Evaluation {
	const reserve = input.reserveGems ?? 0;
	const lastDay = input.gemsByDay.length - 1;
	const byPeriod = new Map<string, number[]>();
	for (const i of chosen) {
		const pid = input.targets[i].periodId;
		byPeriod.set(pid, [...(byPeriod.get(pid) ?? []), i]);
	}

	const stacks = { ...input.stacks };
	const stackStart = new Map<number, number>();
	const pullsOf = new Map<number, number>();
	const passed = new Set<number>();
	const spendByDay = new Map<number, number>();
	const periods: PeriodSpend[] = [];
	let gemsSpent = 0;
	let ticketsUsed = 0;
	let deficit = 0;

	for (const period of input.periods) {
		const idx = byPeriod.get(period.id);
		if (!idx) continue;
		let pulls = 0;
		const drawn: number[] = [];
		// 같은 기간 안에서는 우선순위 순서로 스택을 소비한다 (같은 종류 둘이면 두 번째는 0에서)
		for (const i of [...idx].sort((a, b) => a - b)) {
			const t = input.targets[i];
			const start = Math.min(stacks[t.stackType] ?? 0, input.rule.full - 1);
			stackStart.set(i, start);
			const n = goalPulls(t.goal, start, input.rule);
			// 반천장을 이미 지난 반천장 목표: 뽑지 않는다 — 스택은 넘긴 픽업처럼 그대로 이월
			if (n === null) {
				passed.add(i);
				continue;
			}
			pullsOf.set(i, n);
			pulls += n;
			drawn.push(i);
			stacks[t.stackType] = 0;
		}
		if (drawn.length === 0) continue;
		const day = Math.min(spendDay(period), lastDay);
		const ownedTickets = Math.max(0, (input.ticketPullsByDay[day] ?? 0) - ticketsUsed);
		const inProgress = period.startDay <= 0;
		const s = spendInPeriod(
			pulls,
			ownedTickets,
			inProgress ? input.currentMileage : 0,
			input.mileage,
			period.freePulls ?? 0
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
			targetIds: drawn.map((i) => input.targets[i].id),
			pulls,
			gemPulls: s.gemPulls,
			ticketPulls: s.ticketPulls,
			mileagePulls: s.mileagePulls,
			freePulls: s.freePulls,
			gemsBefore: before,
			gemsAfter: before - gems
		});
	}
	return { deficit: Math.max(0, deficit), periods, stackStart, pullsOf, passed, spendByDay };
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

export function planPickups(input: PlannerInput, options: PlanOptions = {}): PlannerResult {
	if (input.gemsByDay.length === 0) throw new Error('gemsByDay가 비어 있다');
	if (input.costPerPull <= 0) throw new Error('costPerPull은 1 이상이어야 한다');
	const minAfter = suffixMin(input.gemsByDay);
	const n = input.targets.length;
	const usable = input.targets.map((t) => availability(input, t) === null);

	// 1. 우선순위 계획
	const plan: number[] = [];
	/** 그때의 계획으로는 반천장을 이미 지난 반천장 목표 — 계획을 다 세운 뒤 다시 넣어 본다 */
	const deferred: number[] = [];
	for (let i = 0; i < n; i++) {
		if (!usable[i]) continue;
		const ev = evaluateSet(input, [...plan, i], minAfter);
		if (ev.passed.has(i)) deferred.push(i);
		else if (ev.deficit === 0) plan.push(i);
	}
	// 뒤 순위라도 앞 날짜의 같은 종류 목표가 계획에 들면 스택이 0이 되어 반천장까지 도전할 수 있다.
	// 그 목표 덕분이므로 그 목표들을 둔 채로 넣어 보고, 그래도 반천장을 지났으면 불가(half_passed)
	const retried = new Map<number, Evaluation>();
	for (const i of deferred) {
		const ev = evaluateSet(input, [...plan, i], minAfter);
		if (!ev.passed.has(i) && ev.deficit === 0) plan.push(i);
		else retried.set(i, ev);
	}
	// 목표를 더하면 같은 종류의 뒤 목표 시작 스택은 줄기만 한다 — 계획에 든 목표가 나중에 반천장을 지난 목표가 되지는 않는다
	const planned = evaluateSet(input, plan, minAfter);

	// 2. 목표별 결과. 못 넣은 목표는 "앞 순위 계획에 이 목표를 더하면" 기준 — 스택 시작값과 모자란 청휘석 모두.
	//    계획에 든 뒤 순위 목표는 빼고 센다: 뒤 순위는 앞 순위를 밀어내지 않으므로, 이 목표가 들어가면 그쪽이 다시 맞춰진다
	//    (1번의 우선순위 계획이 이 목표를 넣어 볼 때와 같은 묶음 — 모자란 만큼 더 받으면 이 목표가 계획에 든다)
	const outcomes: TargetOutcome[] = input.targets.map((t, i) => {
		const unavailable = availability(input, t);
		if (unavailable) return unavailable;
		const inPlan = plan.includes(i);
		const ev = inPlan
			? planned
			: (retried.get(i) ?? evaluateSet(input, [...plan.filter((j) => j < i), i], minAfter));
		if (ev.passed.has(i))
			return { kind: 'unavailable', id: t.id, periodId: t.periodId, reason: 'half_passed' };
		const stackStart = ev.stackStart.get(i) ?? 0;
		const pullsToPity = input.rule.full - stackStart;
		const pulls = ev.pullsOf.get(i) ?? pullsToPity;
		const guaranteed = pulls >= pullsToPity;
		const common: OutcomeBase = {
			id: t.id,
			periodId: t.periodId,
			goal: t.goal?.kind ?? 'pity',
			stackStart,
			pullsToPity,
			pulls,
			guaranteed,
			probability:
				t.rate === null ? null : chargeProbAtLeastOne(t.rate, stackStart, pulls, input.rule),
			probabilityBeforePity: beforePity(t, stackStart, input.rule)
		};
		if (!inPlan) return { kind: 'short', ...common, shortfallGems: ev.deficit };
		return { kind: guaranteed ? 'secured' : 'attempt', ...common };
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
		securedCount: outcomes.filter((o) => o.kind === 'secured').length,
		attemptCount: outcomes.filter((o) => o.kind === 'attempt').length,
		periods: planned.periods,
		balance,
		alternatives:
			options.alternatives === false ? [] : findAlternatives(input, usable, plan, minAfter)
	};
}

/**
 * 우선순위 계획보다 계획에 더 많이 드는 조합(확보 + 도전). 든 수가 많은 순, 같으면 높은 우선순위를 지키는 순.
 * 반천장을 이미 지난 목표가 든 조합은 건너뛴다 — 그 목표를 뺀 조합과 같고, 데려오는 것이 아니다.
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
		const ev = evaluateSet(input, set, minAfter);
		if (ev.deficit === 0 && ev.passed.size === 0) found.push({ set, weight: weight(set) });
	}
	found.sort((a, b) => b.set.length - a.set.length || b.weight - a.weight);
	const ids = (set: number[]) => set.map((i) => input.targets[i].id);
	return found.slice(0, 2).map(({ set }) => ({
		plannedIds: ids(set),
		droppedIds: ids(plan.filter((i) => !set.includes(i))),
		gainedIds: ids(set.filter((i) => !plan.includes(i)))
	}));
}
