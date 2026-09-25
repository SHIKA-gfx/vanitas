// index.ts의 레벨·AP·카페 조회 함수 테스트. index.test.ts에 합쳐도 된다.
import { describe, expect, it } from 'vitest';
import {
	getApConfig,
	getCafeApPerHour,
	getCafeRank,
	getLevelTable,
	getLevelUpBonusAp,
	listCafeRanks
} from './index';

describe('레벨업 보너스 AP', () => {
	it('도달 레벨의 apMax, 1레벨은 0', () => {
		expect(getLevelUpBonusAp(1)).toBe(0);
		expect(getLevelUpBonusAp(2)).toBe(28);
		expect(getLevelUpBonusAp(90)).toBe(240);
	});

	it('2~90 합이 derived.levelUpBonusApTotal과 같다', () => {
		const { levels, derived } = getLevelTable();
		const sum = levels.reduce((acc, r) => acc + getLevelUpBonusAp(r.level), 0);
		expect(sum).toBe(derived.levelUpBonusApTotal); // 13,186
	});

	it('없는 레벨은 예외', () => {
		expect(() => getLevelUpBonusAp(91)).toThrow();
	});
});

describe('카페', () => {
	it('랭크 10개', () => {
		expect(listCafeRanks().map((r) => r.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
	});

	it('시간당 생산: 기본(maxStorage/96) + 쾌적도 × apPerComfort', () => {
		const r10 = getCafeRank(10);
		expect(getCafeApPerHour(r10, 0)).toBeCloseTo(740 / 96);
		expect(getCafeApPerHour(r10, r10.maxComfort)).toBeCloseTo(30.808, 3);
	});

	it('없는 랭크는 예외', () => {
		expect(() => getCafeRank(11)).toThrow();
	});
});

describe('AP 설정', () => {
	it('전술대회 상점은 고정 수급이 아니라 별도 블록', () => {
		const ap = getApConfig();
		expect(ap.fixedIncome.some((i) => i.id === 'tactical-shop')).toBe(false);
		expect(ap.tacticalShop.refresh.maxPerDay).toBe(3);
	});
});
