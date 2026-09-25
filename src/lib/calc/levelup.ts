// 레벨업 소요일 계산.
// 데이터 구조를 모르는 순수 함수만 둔다. 수치는 모두 인자로 받고, 연결은 어댑터가 한다.
//
// 하루 단위 루프로 계산하는 이유: 레벨업하면 보너스 AP를 받고, 그 AP가 다시 경험치가 되어
// 다음 레벨업을 앞당긴다. 이 되먹임 때문에 "필요 경험치 ÷ 하루 수급"으로는 맞지 않는다.
//
// 가정: 경험치 : AP = 1 : 1, 얻은 AP는 그날 모두 쓴다.
// 레벨업 보너스 AP도 같은 날 쓴다 (상한 초과분은 우편함으로 가지만 소멸하지 않으므로).

/** 레벨 한 칸. 어댑터가 level-table에서 만든다. */
export interface LevelStep {
	level: number;
	/** 다음 레벨까지 필요한 경험치. 최고 레벨은 null */
	expToNext: number | null;
	/** 이 레벨에 도달할 때 받는 AP. 1레벨은 0 */
	bonusApOnReach: number;
}

/** 레벨과, 그 레벨 안에서 쌓인 경험치 (게임 화면 표기와 같은 기준) */
export interface LevelState {
	level: number;
	exp: number;
}

/**
 * day일째에 얻는 AP (day ≥ 1).
 * level은 그날 시작 시점의 레벨 — 자연 회복이 레벨별 AP 최대치에서 멈추기 때문에 넘겨준다.
 */
export type DailyApFn = (day: number, level: number) => number;

export interface DayRecord {
	/** 0 = 계산 시점(보유 AP만 사용), 1부터 하루씩. 날짜 대응은 어댑터가 정한다 */
	day: number;
	/** 그날이 끝났을 때의 상태 */
	level: number;
	exp: number;
	/** 그날 얻은 AP (레벨업 보너스 제외) */
	apIncome: number;
	/** 그날 받은 레벨업 보너스 AP */
	apBonus: number;
}

export type InvalidReason =
	| 'table_malformed'
	| 'level_out_of_range'
	| 'exp_out_of_range'
	| 'target_out_of_range'
	| 'negative_ap';

export interface SimParams {
	table: LevelStep[];
	start: LevelState;
	/** 계산 시점에 가지고 있는 AP. day 0에 쓴다 */
	initialAp: number;
	dailyAp: DailyApFn;
}

// ---------------------------------------------------------------- 검사

/** table[i].level === i + 1, 마지막 칸만 expToNext가 null */
function isValidTable(table: LevelStep[]): boolean {
	if (table.length === 0) return false;
	return table.every((step, i) => {
		const isLast = i === table.length - 1;
		if (step.level !== i + 1) return false;
		if (step.bonusApOnReach < 0) return false;
		return isLast ? step.expToNext === null : step.expToNext !== null && step.expToNext > 0;
	});
}

export function validateStart(table: LevelStep[], start: LevelState): InvalidReason | null {
	if (!isValidTable(table)) return 'table_malformed';
	if (!Number.isInteger(start.level) || start.level < 1 || start.level > table.length) {
		return 'level_out_of_range';
	}
	const need = table[start.level - 1].expToNext;
	const maxExp = need === null ? 0 : need - 1;
	if (!Number.isInteger(start.exp) || start.exp < 0 || start.exp > maxExp)
		return 'exp_out_of_range';
	return null;
}

// ---------------------------------------------------------------- 핵심 루프

/**
 * 경험치를 더하고 레벨업을 처리한다.
 * 레벨업 보너스 AP는 곧바로 경험치가 되므로, 한 번에 여러 레벨이 오를 수 있다.
 * 최고 레벨에 닿으면 남은 경험치는 버린다.
 */
export function gainExp(
	table: LevelStep[],
	state: LevelState,
	amount: number
): { state: LevelState; bonusAp: number } {
	let level = state.level;
	let exp = state.exp + amount;
	let bonusAp = 0;

	for (;;) {
		const need = table[level - 1].expToNext;
		if (need === null) {
			exp = 0;
			break;
		}
		if (exp < need) break;
		exp -= need;
		level += 1;
		const bonus = table[level - 1].bonusApOnReach;
		bonusAp += bonus;
		exp += bonus;
	}
	return { state: { level, exp }, bonusAp };
}

/**
 * day 0(보유 AP)부터 하루씩 진행한다.
 * shouldStop이 true를 돌려주거나 최고 레벨에 닿으면 그날 기록까지 남기고 멈춘다.
 */
export function simulate(
	p: SimParams,
	maxDays: number,
	shouldStop: (state: LevelState) => boolean = () => false
): DayRecord[] {
	const cap = p.table.length;
	const first = gainExp(p.table, p.start, p.initialAp);
	let state = first.state;
	const records: DayRecord[] = [
		{ day: 0, ...state, apIncome: p.initialAp, apBonus: first.bonusAp }
	];

	for (let day = 1; day <= maxDays; day++) {
		if (state.level === cap || shouldStop(state)) break;
		const income = p.dailyAp(day, state.level);
		const next = gainExp(p.table, state, income);
		state = next.state;
		records.push({ day, ...state, apIncome: income, apBonus: next.bonusAp });
	}
	return records;
}

// ---------------------------------------------------------------- 판정

export type ReachResult =
	| { kind: 'invalid'; reason: InvalidReason }
	/** 시작 레벨이 이미 최고 레벨 */
	| { kind: 'at_cap' }
	/** 시작 레벨이 이미 목표 이상 */
	| { kind: 'already' }
	/** days일째에 도달. 0이면 보유 AP만으로 도달 */
	| { kind: 'reached'; days: number; records: DayRecord[] }
	/** 계산 한도 안에 도달하지 못함 */
	| { kind: 'beyond_horizon'; horizonDays: number; records: DayRecord[] };

/** 목표 레벨 모드: 언제 도달하는가 */
export function daysToLevel(p: SimParams, target: number, horizonDays: number): ReachResult {
	const invalid = validateStart(p.table, p.start);
	if (invalid) return { kind: 'invalid', reason: invalid };
	if (p.initialAp < 0) return { kind: 'invalid', reason: 'negative_ap' };
	if (!Number.isInteger(target) || target < 1 || target > p.table.length) {
		return { kind: 'invalid', reason: 'target_out_of_range' };
	}
	if (p.start.level === p.table.length) return { kind: 'at_cap' };
	if (p.start.level >= target) return { kind: 'already' };

	const records = simulate(p, horizonDays, (s) => s.level >= target);
	const last = records[records.length - 1];
	if (last.level >= target) return { kind: 'reached', days: last.day, records };
	return { kind: 'beyond_horizon', horizonDays, records };
}

export type ProjectionResult =
	| { kind: 'invalid'; reason: InvalidReason }
	| { kind: 'at_cap' }
	/** day일째 끝의 예상 상태. 도중에 최고 레벨에 닿으면 capDay에 그날을 담는다 */
	| { kind: 'projected'; state: LevelState; capDay: number | null; records: DayRecord[] };

/** 날짜 모드: 그날 몇 레벨인가 */
export function levelOnDay(p: SimParams, day: number): ProjectionResult {
	const invalid = validateStart(p.table, p.start);
	if (invalid) return { kind: 'invalid', reason: invalid };
	if (p.initialAp < 0) return { kind: 'invalid', reason: 'negative_ap' };
	if (p.start.level === p.table.length) return { kind: 'at_cap' };

	const records = simulate(p, day);
	const last = records[records.length - 1];
	const cap = p.table.length;
	return {
		kind: 'projected',
		state: { level: last.level, exp: last.exp },
		capDay: last.level === cap ? last.day : null,
		records
	};
}

// ---------------------------------------------------------------- AP 구매

export interface PriceTier {
	fromCount: number;
	toCount: number;
	price: number;
}

/** 하루 count회 구매할 때 드는 청휘석. 구간표 밖이면 null */
export function purchaseCostPerDay(count: number, tiers: PriceTier[]): number | null {
	if (!Number.isInteger(count) || count < 0) return null;
	let total = 0;
	for (let n = 1; n <= count; n++) {
		const tier = tiers.find((t) => t.fromCount <= n && n <= t.toCount);
		if (!tier) return null;
		total += tier.price;
	}
	return total;
}

// ---------------------------------------------------------------- 하루 수급 부품

/**
 * 주기 수급을 하루씩 고르게 나눈다. 정수를 유지하며, 한 주기를 채우면 합이 정확히 amount다.
 * 사용자마다 주기 위치(요일, 출석 회차)가 달라 날짜를 특정하지 않는다. 오차는 최대 한 주기분.
 */
export function spreadEvenly(amount: number, periodDays: number, day: number): number {
	return Math.floor((day * amount) / periodDays) - Math.floor(((day - 1) * amount) / periodDays);
}

/**
 * 자연 회복으로 하루에 실제로 받는 AP.
 * 자연 회복은 AP 최대치에서 멈추므로, 접속 간격 동안 쌓일 양이 최대치를 넘으면 그만큼 버려진다.
 * 접속할 때마다 AP를 모두 쓴다고 가정한다.
 */
export function naturalDailyAp(apPerDay: number, logins: number, apMax: number): number {
	return logins * Math.min(apPerDay / logins, apMax);
}

/**
 * 카페 하루 AP. 하루 1회 이상 수확한다고 가정한다.
 * (최대 쾌적도면 모든 랭크가 24시간 안팎에 만충이라 수확 횟수 차이가 거의 없다.)
 *
 * 소수점은 내부 누적 후 수확할 때 버린다 (cafe-ranks.json formulas.accumulatedAp).
 * 2026-09-25 게임 내 확인: 수확 후 1시간 30 → 2시간 61 (매시간 버림이었다면 60).
 * 1e-9는 부동소수 오차로 정수가 한 칸 내려가는 것을 막는다.
 */
export function cafeDailyAp(apPerHour: number, maxStorage: number): number {
	return Math.min(Math.floor(apPerHour * 24 + 1e-9), maxStorage);
}

export interface TacticalShopRule {
	apItems: { ap: number; price: number }[];
	refresh: { price: number; maxPerDay: number };
}

/**
 * 전술대회 상점에서 하루에 사는 AP와 드는 코인.
 * 처음 진열분 + 갱신 횟수만큼 AP 상품을 모두 산다고 본다. 범위 밖이면 null.
 */
export function tacticalShopPerDay(
	refreshes: number,
	shop: TacticalShopRule
): { ap: number; coins: number } | null {
	if (!Number.isInteger(refreshes) || refreshes < 0 || refreshes > shop.refresh.maxPerDay) {
		return null;
	}
	const rounds = refreshes + 1;
	const ap = shop.apItems.reduce((sum, item) => sum + item.ap, 0) * rounds;
	const itemCoins = shop.apItems.reduce((sum, item) => sum + item.price, 0) * rounds;
	return { ap, coins: itemCoins + shop.refresh.price * refreshes };
}
