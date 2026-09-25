// 레벨업 계산기 어댑터.
// data 계층에서 수치를 꺼내 하루 수급 함수를 조립하고, levelup.ts의 판정을 화면용 결과로 바꾼다.
// 화면은 outcome.kind만 보고 문구를 고른다.

import {
	getApConfig,
	getCafeApPerHour,
	getCafeRank,
	getLevelTable,
	getLevelUpBonusAp,
	listCafeRanks,
	type ServerId
} from '$lib/data';
import { addDays, daysBetween, isDateString } from '$lib/game-date';
import {
	cafeDailyAp,
	daysToLevel,
	levelOnDay,
	naturalDailyAp,
	purchaseCostPerDay,
	spreadEvenly,
	tacticalShopPerDay,
	type DailyApFn,
	type DayRecord,
	type LevelState,
	type LevelStep,
	type SimParams
} from './levelup';

/** 목표 레벨 모드에서 이보다 오래 걸리면 beyond_horizon */
export const HORIZON_DAYS = 3650;

/** 하루 접속 횟수 선택지. 3은 "3회 이상" */
export const LOGIN_OPTIONS = [1, 2, 3] as const;

const PERIOD_DAYS = { daily: 1, weekly: 7, every10days: 10 } as const;

export interface LevelUpInput {
	level: number;
	/** 현재 레벨 안에서 쌓인 경험치 (게임 화면 표기와 같다) */
	exp: number;
	/** 지금 가진 AP. 우편함에 쌓인 AP도 포함 */
	currentAp: number;
	/** 하루 접속 횟수 (LOGIN_OPTIONS) */
	logins: number;
	cafeRank: number;
	cafeComfort: number;
	/** 받지 않는 고정 수급의 id. 유료 패키지는 apPackageDays로 따로 다룬다 */
	disabledIncome: string[];
	/** 2주 AP 패키지를 내일부터 받을 수 있는 일수 */
	apPackageDays: number;
	/** 전술대회 상점 갱신 횟수. null이면 AP를 사지 않는다 */
	tacticalRefreshes: number | null;
	/** 하루 청휘석 AP 구매 횟수 */
	apPurchases: number;
	/** 계산 기준 게임 날짜. day N의 날짜 = today + N (오늘 남은 수급은 세지 않는다) */
	today: string;
	goal: { mode: 'level'; target: number } | { mode: 'date'; date: string };
	server?: ServerId;
}

/** 입력 오류가 난 칸. 화면은 이 칸 옆에 안내를 띄운다 */
export type LevelUpField =
	| 'level'
	| 'exp'
	| 'currentAp'
	| 'logins'
	| 'cafeRank'
	| 'cafeComfort'
	| 'apPackageDays'
	| 'tacticalRefreshes'
	| 'apPurchases'
	| 'goal';

export interface LevelUpCost {
	/** 청휘석 AP 구매에 쓰는 청휘석 합계 */
	pyroxene: number;
	/** 전술대회 상점에 쓰는 코인 합계 */
	tacticalCoins: number;
	/** 구매가 일어난 일수 */
	days: number;
}

export type LevelUpOutcome =
	| { kind: 'invalid'; field: LevelUpField }
	| { kind: 'at_cap' }
	| { kind: 'already' }
	| { kind: 'reached'; days: number; date: string; cost: LevelUpCost; records: DayRecord[] }
	| { kind: 'beyond_horizon'; horizonDays: number; records: DayRecord[] }
	| {
			kind: 'projected';
			date: string;
			state: LevelState;
			/** 그 레벨의 레벨업 필요 경험치. 최고 레벨이면 null */
			expToNext: number | null;
			/** 도중에 최고 레벨에 닿는 날. 안 닿으면 null */
			capDate: string | null;
			cost: LevelUpCost;
			records: DayRecord[];
	  };

// ---------------------------------------------------------------- 화면 보조

/** 입력칸 옆 표시용: 하루 청휘석 AP 구매 비용 */
export function apPurchaseCostPerDay(count: number, server: ServerId = 'ko'): number | null {
	return purchaseCostPerDay(count, getApConfig(server).purchase.priceTiers);
}

/** 입력칸 옆 표시용: 전술대회 상점 하루 AP·코인 */
export function tacticalPerDay(refreshes: number, server: ServerId = 'ko') {
	return tacticalShopPerDay(refreshes, getApConfig(server).tacticalShop);
}

// ---------------------------------------------------------------- 조립

function isIntIn(value: number, min: number, max: number): boolean {
	return Number.isInteger(value) && value >= min && value <= max;
}

function checkInput(input: LevelUpInput, server: ServerId): LevelUpField | null {
	const ap = getApConfig(server);
	const ranks = listCafeRanks(server);
	const packageItem = ap.fixedIncome.find((i) => i.durationDays !== undefined);

	if (!isIntIn(input.currentAp, 0, Number.MAX_SAFE_INTEGER)) return 'currentAp';
	if (!(LOGIN_OPTIONS as readonly number[]).includes(input.logins)) return 'logins';
	if (!ranks.some((r) => r.rank === input.cafeRank)) return 'cafeRank';
	if (!isIntIn(input.cafeComfort, 0, getCafeRank(input.cafeRank, server).maxComfort)) {
		return 'cafeComfort';
	}
	if (!isIntIn(input.apPackageDays, 0, packageItem?.durationDays ?? 0)) return 'apPackageDays';
	if (
		input.tacticalRefreshes !== null &&
		!isIntIn(input.tacticalRefreshes, 0, ap.tacticalShop.refresh.maxPerDay)
	) {
		return 'tacticalRefreshes';
	}
	if (!isIntIn(input.apPurchases, 0, ap.purchase.maxPurchasesPerDay)) return 'apPurchases';
	return null;
}

function buildTable(server: ServerId): LevelStep[] {
	return getLevelTable(server).levels.map((row) => ({
		level: row.level,
		expToNext: row.expToNext,
		bonusApOnReach: getLevelUpBonusAp(row.level, server)
	}));
}

/** 하루 수급 함수. 입력 검사를 통과한 뒤에만 부른다 */
function buildDailyAp(input: LevelUpInput, server: ServerId): DailyApFn {
	const ap = getApConfig(server);
	const apMaxByLevel = getLevelTable(server).levels.map((r) => r.apMax);
	const rank = getCafeRank(input.cafeRank, server);
	const cafe = cafeDailyAp(getCafeApPerHour(rank, input.cafeComfort), rank.maxStorage);
	const tactical =
		input.tacticalRefreshes === null
			? 0
			: (tacticalShopPerDay(input.tacticalRefreshes, ap.tacticalShop)?.ap ?? 0);
	const purchased = input.apPurchases * ap.purchase.apPerPurchase;
	const fixed = ap.fixedIncome.filter(
		(i) => i.durationDays === undefined && !input.disabledIncome.includes(i.id)
	);
	const limited = ap.fixedIncome.filter((i) => i.durationDays !== undefined);

	return (day, level) => {
		let total =
			naturalDailyAp(ap.recovery.apPerDay, input.logins, apMaxByLevel[level - 1]) +
			cafe +
			tactical +
			purchased;
		for (const item of fixed) total += spreadEvenly(item.ap, PERIOD_DAYS[item.period], day);
		for (const item of limited) {
			if (day <= input.apPackageDays) total += spreadEvenly(item.ap, PERIOD_DAYS[item.period], day);
		}
		return total;
	};
}

function costFor(input: LevelUpInput, days: number, server: ServerId): LevelUpCost {
	const perDayPyroxene = apPurchaseCostPerDay(input.apPurchases, server) ?? 0;
	const perDayCoins =
		input.tacticalRefreshes === null
			? 0
			: (tacticalPerDay(input.tacticalRefreshes, server)?.coins ?? 0);
	return { pyroxene: perDayPyroxene * days, tacticalCoins: perDayCoins * days, days };
}

const START_FIELD = {
	level_out_of_range: 'level',
	exp_out_of_range: 'exp',
	negative_ap: 'currentAp',
	target_out_of_range: 'goal'
} as const;

// ---------------------------------------------------------------- 진입점

export function calculateLevelUp(input: LevelUpInput): LevelUpOutcome {
	const server = input.server ?? 'ko';
	const bad = checkInput(input, server);
	if (bad) return { kind: 'invalid', field: bad };

	const table = buildTable(server);
	const params: SimParams = {
		table,
		start: { level: input.level, exp: input.exp },
		initialAp: input.currentAp,
		dailyAp: buildDailyAp(input, server)
	};

	if (input.goal.mode === 'level') {
		const r = daysToLevel(params, input.goal.target, HORIZON_DAYS);
		switch (r.kind) {
			case 'invalid':
				if (r.reason === 'table_malformed') throw new Error('level-table 구조 오류');
				return { kind: 'invalid', field: START_FIELD[r.reason] };
			case 'reached':
				return {
					kind: 'reached',
					days: r.days,
					date: addDays(input.today, r.days),
					cost: costFor(input, r.days, server),
					records: r.records
				};
			default:
				return r;
		}
	}

	if (!isDateString(input.goal.date)) return { kind: 'invalid', field: 'goal' };
	const days = daysBetween(input.today, input.goal.date);
	if (days < 0) return { kind: 'invalid', field: 'goal' };

	const r = levelOnDay(params, days);
	switch (r.kind) {
		case 'invalid':
			if (r.reason === 'table_malformed') throw new Error('level-table 구조 오류');
			return { kind: 'invalid', field: START_FIELD[r.reason] };
		case 'at_cap':
			return r;
		case 'projected': {
			const spentDays = r.records[r.records.length - 1].day;
			return {
				kind: 'projected',
				date: input.goal.date,
				state: r.state,
				expToNext: table[r.state.level - 1].expToNext,
				capDate: r.capDay === null ? null : addDays(input.today, r.capDay),
				cost: costFor(input, spentDays, server),
				records: r.records
			};
		}
	}
}
