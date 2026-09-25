import { describe, expect, it } from 'vitest';
import {
	apPurchaseCostPerDay,
	calculateLevelUp,
	tacticalPerDay,
	type LevelUpInput
} from './levelup-adapter';

// 기준 조건: Lv.60 → 90, 하루 2회 접속, 카페 8랭크 최대 쾌적도, 무료 고정 수급 전부, 구매 없음
const base: LevelUpInput = {
	level: 60,
	exp: 0,
	currentAp: 0,
	logins: 2,
	cafeRank: 8,
	cafeComfort: 4500,
	disabledIncome: [],
	apPackageDays: 0,
	tacticalRefreshes: null,
	apPurchases: 0,
	today: '2026-09-25',
	goal: { mode: 'level', target: 90 }
};
const run = (over: Partial<LevelUpInput> = {}) => calculateLevelUp({ ...base, ...over });

describe('목표 레벨 모드 — 회귀 기준값', () => {
	// 하루 AP: 자연 240 + 일일 150 + 무료 10 + 주간 200/7 + 출석 150/10 + 카페 600 ≈ 1,043.6
	it('기준 조건 214일', () => {
		expect(run()).toMatchObject({ kind: 'reached', days: 214, date: '2027-04-27' });
	});

	it('하루 1회 접속이면 자연 회복 손실로 늦어진다', () => {
		expect(run({ logins: 1 })).toMatchObject({ kind: 'reached', days: 219 });
	});

	it('청휘석 구매 6회: 127일, 청휘석 270 × 127', () => {
		expect(run({ apPurchases: 6 })).toMatchObject({
			kind: 'reached',
			days: 127,
			cost: { pyroxene: 270 * 127, tacticalCoins: 0, days: 127 }
		});
	});

	it('전술대회 상점 갱신 3회: 코인 210/일', () => {
		const r = run({ tacticalRefreshes: 3 });
		expect(r.kind).toBe('reached');
		if (r.kind === 'reached') expect(r.cost.tacticalCoins).toBe(210 * r.days);
	});

	it('고정 수급을 끄면 늦어진다', () => {
		const off = run({ disabledIncome: ['daily-mission'] });
		expect(off.kind === 'reached' && off.days).toBeGreaterThan(214);
	});

	it('2주 패키지는 입력한 일수만큼만', () => {
		const r = run({ apPackageDays: 14 });
		// 150 × 14 = 2,100 AP ≈ 2일 앞당김
		expect(r).toMatchObject({ kind: 'reached', days: 212 });
	});

	it('보유 AP만으로 도달하면 0일, 비용 0', () => {
		expect(run({ goal: { mode: 'level', target: 61 }, currentAp: 3900 })).toMatchObject({
			kind: 'reached',
			days: 0,
			date: '2026-09-25',
			cost: { pyroxene: 0, days: 0 }
		});
	});

	it('이미 도달 / 최고 레벨', () => {
		expect(run({ goal: { mode: 'level', target: 60 } })).toEqual({ kind: 'already' });
		expect(run({ level: 90 })).toEqual({ kind: 'at_cap' });
	});
});

describe('날짜 모드', () => {
	it('그날의 레벨과 레벨 안 경험치', () => {
		const r = run({ goal: { mode: 'date', date: '2026-10-25' } });
		expect(r).toMatchObject({ kind: 'projected', date: '2026-10-25', capDate: null });
		if (r.kind === 'projected') {
			expect(r.state.level).toBeGreaterThan(60);
			expect(r.expToNext).not.toBeNull();
			expect(r.state.exp).toBeLessThan(r.expToNext!);
		}
	});

	it('도중에 최고 레벨이면 그날과 비용 일수를 거기서 끊는다', () => {
		const r = run({ goal: { mode: 'date', date: '2028-01-01' }, apPurchases: 3 });
		expect(r.kind).toBe('projected');
		if (r.kind === 'projected') {
			expect(r.state).toEqual({ level: 90, exp: 0 });
			expect(r.capDate).not.toBeNull();
			expect(r.expToNext).toBeNull();
			expect(r.cost.pyroxene).toBe(90 * r.cost.days);
		}
	});

	it('오늘이면 보유 AP만 반영', () => {
		expect(run({ goal: { mode: 'date', date: '2026-09-25' } })).toMatchObject({
			kind: 'projected',
			state: { level: 60, exp: 0 }
		});
	});
});

describe('입력 검사 — 오류 칸을 돌려준다', () => {
	it.each([
		[{ level: 91 }, 'level'],
		[{ exp: 3900 }, 'exp'], // Lv.60 필요치 3,900 → 3,899까지
		[{ currentAp: -1 }, 'currentAp'],
		[{ logins: 4 }, 'logins'],
		[{ cafeRank: 11 }, 'cafeRank'],
		[{ cafeComfort: 4501 }, 'cafeComfort'],
		[{ apPackageDays: 15 }, 'apPackageDays'],
		[{ tacticalRefreshes: 4 }, 'tacticalRefreshes'],
		[{ apPurchases: 21 }, 'apPurchases'],
		[{ goal: { mode: 'level', target: 91 } }, 'goal'],
		[{ goal: { mode: 'date', date: '2026-09-24' } }, 'goal'],
		[{ goal: { mode: 'date', date: '2026-13-01' } }, 'goal']
	] as [Partial<LevelUpInput>, string][])('%o → %s', (over, field) => {
		expect(run(over)).toEqual({ kind: 'invalid', field });
	});
});

describe('입력칸 옆 표시값', () => {
	it('청휘석 하루 비용', () => {
		expect(apPurchaseCostPerDay(6)).toBe(270);
		expect(apPurchaseCostPerDay(20)).toBe(3120);
	});
	it('전술대회 하루 AP·코인', () => {
		expect(tacticalPerDay(3)).toEqual({ ap: 360, coins: 210 });
	});
});
