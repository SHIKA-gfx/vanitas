import { describe, expect, it } from 'vitest';
import { getGameConfig, getPerUnitRate, getPoolEntry, getRateGroups, listBannerTypes } from './index';

describe('확률 그룹', () => {
	it('한국 운영 배너의 모든 variant는 합이 100%다', () => {
		for (const banner of listBannerTypes()) {
			for (const [variant, groups] of Object.entries(banner.rateGroups)) {
				const total = groups.reduce((sum, g) => sum + g.rate, 0);
				expect(total, `${banner.id}.${variant}`).toBeCloseTo(100, 6);
			}
		}
	});

	it('10회차 보정은 ★3 확률을 바꾸지 않는다 (닫힌 식 성립 조건)', () => {
		// 선별 모집(신규 계정 무료 1회)은 10회차 ★3 확정이라 이 규칙의 대상이 아니다.
		const repeatable = listBannerTypes().filter((b) => b.pointPool !== null);
		expect(repeatable.length).toBeGreaterThan(0);

		for (const banner of repeatable) {
			const base = banner.rateGroups.default;
			const tenth = banner.rateGroups.tenthPull;
			if (!base || !tenth) continue;
			const sum3 = (gs: typeof base) =>
				gs.filter((g) => g.rarity === 3).reduce((s, g) => s + g.rate, 0);
			expect(sum3(tenth), banner.id).toBeCloseTo(sum3(base), 9);
		}
	});
});

describe('풀 조회', () => {
	it('상시 모집 ★3 풀은 109명이다', () => {
		expect(getPoolEntry('standard_3s')?.size).toBe(109);
	});

	it('시점을 지정하면 그 이전 스냅샷을 쓴다', () => {
		expect(getPoolEntry('standard_3s', { asOf: '2026-09-18' })).toBeUndefined();
		expect(getPoolEntry('normal_3s', { asOf: '2026-09-18' })?.size).toBe(108);
	});

	it('개별 확률은 그룹 확률 ÷ 풀 크기다', () => {
		const groups = getRateGroups('standard')!;
		const star3 = groups.find((g) => g.rarity === 3)!;
		expect(getPerUnitRate(star3)).toBeCloseTo(0.027523, 6);
	});
});

describe('천장 설정', () => {
	it('한국은 포인트 방식이며 픽업 획득 시 초기화되지 않는다', () => {
		const c = getGameConfig();
		expect(c.pitySystem.current).toBe('point_exchange');
		expect(c.recruitPoint.resetOnPickupObtained).toBe(false);
		expect(c.recruitPoint.pityThreshold).toBe(200);
	});
});