import { describe, expect, it } from 'vitest';
import {
	cafeDailyAp,
	daysToLevel,
	gainExp,
	levelOnDay,
	naturalDailyAp,
	purchaseCostPerDay,
	simulate,
	spreadEvenly,
	tacticalShopPerDay,
	validateStart,
	type LevelStep,
	type SimParams
} from './levelup';

// 합성 표: 1 →(10)→ 2 →(20)→ 3 →(30)→ 4(최고)
// 도달 보너스: 2레벨 5, 3레벨 7, 4레벨 9
const table: LevelStep[] = [
	{ level: 1, expToNext: 10, bonusApOnReach: 0 },
	{ level: 2, expToNext: 20, bonusApOnReach: 5 },
	{ level: 3, expToNext: 30, bonusApOnReach: 7 },
	{ level: 4, expToNext: null, bonusApOnReach: 9 }
];

const noBonus = table.map((s) => ({ ...s, bonusApOnReach: 0 }));

const params = (over: Partial<SimParams> = {}): SimParams => ({
	table,
	start: { level: 1, exp: 0 },
	initialAp: 0,
	dailyAp: () => 4,
	...over
});

describe('gainExp', () => {
	it('필요치 미만이면 레벨 유지', () => {
		expect(gainExp(table, { level: 1, exp: 0 }, 9)).toEqual({
			state: { level: 1, exp: 9 },
			bonusAp: 0
		});
	});

	it('레벨업 보너스 AP가 곧바로 경험치가 된다', () => {
		// 10으로 2레벨 → 보너스 5가 경험치로
		expect(gainExp(table, { level: 1, exp: 0 }, 10)).toEqual({
			state: { level: 2, exp: 5 },
			bonusAp: 5
		});
	});

	it('보너스가 다음 레벨업을 연쇄로 일으킨다', () => {
		// 보너스만으로 한 번 더 오르는 표
		const chain: LevelStep[] = [
			{ level: 1, expToNext: 10, bonusApOnReach: 0 },
			{ level: 2, expToNext: 5, bonusApOnReach: 6 },
			{ level: 3, expToNext: null, bonusApOnReach: 1 }
		];
		// 10 → 2레벨, 보너스 6 ≥ 5 → 3레벨
		expect(gainExp(chain, { level: 1, exp: 0 }, 10)).toEqual({
			state: { level: 3, exp: 0 },
			bonusAp: 7
		});
	});

	it('최고 레벨에서는 남은 경험치를 버린다', () => {
		expect(gainExp(table, { level: 3, exp: 0 }, 100).state).toEqual({ level: 4, exp: 0 });
	});
});

describe('validateStart', () => {
	it('정상 입력', () => {
		expect(validateStart(table, { level: 2, exp: 19 })).toBeNull();
	});
	it('레벨 안 경험치는 필요치 미만', () => {
		expect(validateStart(table, { level: 2, exp: 20 })).toBe('exp_out_of_range');
	});
	it('최고 레벨의 경험치는 0만 허용', () => {
		expect(validateStart(table, { level: 4, exp: 1 })).toBe('exp_out_of_range');
	});
	it('레벨 범위', () => {
		expect(validateStart(table, { level: 5, exp: 0 })).toBe('level_out_of_range');
		expect(validateStart(table, { level: 0, exp: 0 })).toBe('level_out_of_range');
	});
	it('표 모양 검사', () => {
		expect(validateStart([], { level: 1, exp: 0 })).toBe('table_malformed');
		const broken = table.map((s, i) => (i === 3 ? { ...s, expToNext: 5 } : s));
		expect(validateStart(broken, { level: 1, exp: 0 })).toBe('table_malformed');
	});
});

describe('simulate', () => {
	it('dailyAp에 그날 시작 시점의 레벨을 넘긴다', () => {
		const seen: [number, number][] = [];
		simulate(
			params({
				dailyAp: (day, level) => {
					seen.push([day, level]);
					return 10;
				}
			}),
			3
		);
		// day1: 1레벨에서 시작 → 10 얻어 2레벨(exp 5)
		// day2: 2레벨에서 시작 → exp 15
		// day3: 2레벨에서 시작 → exp 25 → 3레벨(exp 5+7=12)
		expect(seen).toEqual([
			[1, 1],
			[2, 2],
			[3, 2]
		]);
	});

	it('최고 레벨에 닿으면 멈춘다', () => {
		const records = simulate(params({ dailyAp: () => 100 }), 30);
		expect(records.at(-1)).toMatchObject({ day: 1, level: 4 });
	});
});

describe('daysToLevel', () => {
	it('보너스가 없으면 올림 나눗셈과 같다', () => {
		// 4레벨까지 60, 하루 4 → 15일
		const r = daysToLevel(params({ table: noBonus }), 4, 365);
		expect(r).toMatchObject({ kind: 'reached', days: 15 });
	});

	it('보너스가 있으면 앞당겨진다', () => {
		// 필요 60 - 보너스 (5 + 7) = 48 → 하루 4로 12일
		// (4레벨 도달 보너스 9는 최고 레벨이라 쓰이지 않음)
		const r = daysToLevel(params(), 4, 365);
		expect(r).toMatchObject({ kind: 'reached', days: 12 });
	});

	it('보유 AP만으로 도달하면 0일', () => {
		const r = daysToLevel(params({ initialAp: 10 }), 2, 365);
		expect(r).toMatchObject({ kind: 'reached', days: 0 });
	});

	it('이미 목표 이상 / 최고 레벨', () => {
		expect(daysToLevel(params({ start: { level: 3, exp: 0 } }), 2, 365)).toEqual({
			kind: 'already'
		});
		expect(daysToLevel(params({ start: { level: 4, exp: 0 } }), 4, 365)).toEqual({
			kind: 'at_cap'
		});
	});

	it('한도 안에 못 닿으면 beyond_horizon', () => {
		const r = daysToLevel(params(), 4, 5);
		expect(r).toMatchObject({ kind: 'beyond_horizon', horizonDays: 5 });
	});

	it('입력 오류는 예외가 아니라 결과값', () => {
		expect(daysToLevel(params(), 5, 365)).toEqual({
			kind: 'invalid',
			reason: 'target_out_of_range'
		});
		expect(daysToLevel(params({ initialAp: -1 }), 4, 365)).toEqual({
			kind: 'invalid',
			reason: 'negative_ap'
		});
	});
});

describe('levelOnDay', () => {
	it('그날 끝의 레벨과 경험치', () => {
		// 하루 4 × 3일 = 12 → 10에서 2레벨, 보너스 5 → exp 7
		const r = levelOnDay(params(), 3);
		expect(r).toMatchObject({ kind: 'projected', state: { level: 2, exp: 7 }, capDay: null });
	});

	it('도중에 최고 레벨에 닿으면 그날을 알려준다', () => {
		const r = levelOnDay(params(), 100);
		expect(r).toMatchObject({ kind: 'projected', state: { level: 4 }, capDay: 12 });
	});
});

describe('purchaseCostPerDay', () => {
	// ap-config.json의 구간표와 같은 값
	const tiers = [
		{ fromCount: 1, toCount: 3, price: 30 },
		{ fromCount: 4, toCount: 6, price: 60 },
		{ fromCount: 7, toCount: 9, price: 100 },
		{ fromCount: 10, toCount: 12, price: 150 },
		{ fromCount: 13, toCount: 15, price: 200 },
		{ fromCount: 16, toCount: 20, price: 300 }
	];

	it.each([
		[0, 0],
		[3, 90],
		[6, 270],
		[12, 1020],
		[20, 3120]
	])('%i회 → 청휘석 %i', (count, cost) => {
		expect(purchaseCostPerDay(count, tiers)).toBe(cost);
	});

	it('구간표 밖이면 null', () => {
		expect(purchaseCostPerDay(21, tiers)).toBeNull();
		expect(purchaseCostPerDay(-1, tiers)).toBeNull();
	});
});

describe('spreadEvenly', () => {
	it('정수로 나누고, 한 주기 합은 정확히 amount', () => {
		const week = Array.from({ length: 7 }, (_, i) => spreadEvenly(200, 7, i + 1));
		expect(week.every(Number.isInteger)).toBe(true);
		expect(week.reduce((a, b) => a + b, 0)).toBe(200);
		const tenDays = Array.from({ length: 10 }, (_, i) => spreadEvenly(150, 10, i + 1));
		expect(tenDays).toEqual(Array(10).fill(15));
	});
	it('매일 수급은 그대로', () => {
		expect(spreadEvenly(150, 1, 5)).toBe(150);
	});
});

describe('naturalDailyAp', () => {
	it('최대치가 충분하면 240 전부', () => {
		expect(naturalDailyAp(240, 1, 240)).toBe(240);
		expect(naturalDailyAp(240, 2, 120)).toBe(240);
	});
	it('접속 간격 동안 최대치를 넘는 만큼 버려진다', () => {
		expect(naturalDailyAp(240, 1, 120)).toBe(120);
		expect(naturalDailyAp(240, 3, 60)).toBe(180);
	});
});

describe('cafeDailyAp', () => {
	it('보관 한도에서 멈춘다', () => {
		expect(cafeDailyAp(25.15, 600)).toBe(600); // 8랭크 최대 쾌적도: 603.6 → 600
	});
	it('한도 미만이면 누적 후 버림', () => {
		expect(cafeDailyAp(740 / 96 + 5500 * 0.0042, 740)).toBe(739); // 10랭크 최대 쾌적도
	});
	it('부동소수 오차로 정수가 내려가지 않는다', () => {
		// (11/72)*3*24는 부동소수로 10.999…가 된다
		expect(cafeDailyAp((11 / 24 / 3) * 3, 100)).toBe(11);
	});
});

describe('tacticalShopPerDay', () => {
	const shop = {
		apItems: [
			{ ap: 30, price: 15 },
			{ ap: 60, price: 30 }
		],
		refresh: { price: 10, maxPerDay: 3 }
	};
	it.each([
		[0, 90, 45],
		[1, 180, 100],
		[3, 360, 210]
	])('갱신 %i회 → AP %i, 코인 %i', (refreshes, ap, coins) => {
		expect(tacticalShopPerDay(refreshes, shop)).toEqual({ ap, coins });
	});
	it('갱신 한도 밖이면 null', () => {
		expect(tacticalShopPerDay(4, shop)).toBeNull();
	});
});
