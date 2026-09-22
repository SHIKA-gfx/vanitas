import { describe, expect, it } from 'vitest';
import {
	evaluatePickup,
	evaluatePity,
	expectedPulls,
	perUnitRate,
	probAtLeastOne,
	probAtLeastOneTwoStar,
	probabilityCurve,
	pullBudget
} from './gacha';

/**
 * 게임 업데이트로 확률 구조가 바뀌면 이 테스트가 먼저 깨져야 한다.
 * 수치는 2026-09 ko 기준 공시값. 값이 바뀌면 테스트도 함께 고치고,
 * 그 커밋에 출처와 날짜를 남긴다.
 */

const PICKUP_RATE = perUnitRate(0.7, 1); // 픽업 모집 ★3 픽업 그룹 0.7%, 풀 1명
const PITY = 200;
const COST = 120;

describe('perUnitRate', () => {
	it('그룹 확률을 풀 크기로 나눈다', () => {
		expect(perUnitRate(0.7, 1)).toBeCloseTo(0.007, 10);
		// 픽업 배너의 기타 ★3: 2.3% / 108명
		expect(perUnitRate(2.3, 108)).toBeCloseTo(0.000212963, 9);
		// 상시 모집 ★3: 3.0% / 109명
		expect(perUnitRate(3.0, 109)).toBeCloseTo(0.0002752294, 9);
	});

	it('풀 크기가 0 이하면 던진다', () => {
		expect(() => perUnitRate(0.7, 0)).toThrow();
	});
});

describe('probAtLeastOne', () => {
	it('1회는 개별 확률과 같다', () => {
		expect(probAtLeastOne(PICKUP_RATE, 1)).toBeCloseTo(0.007, 12);
	});

	it('100연 ≈ 50.5%, 200연(천장) ≈ 75.5%', () => {
		expect(probAtLeastOne(PICKUP_RATE, 100)).toBeCloseTo(0.50464, 5);
		expect(probAtLeastOne(PICKUP_RATE, 200)).toBeCloseTo(0.75461, 5);
	});

	it('0회·0확률은 0', () => {
		expect(probAtLeastOne(PICKUP_RATE, 0)).toBe(0);
		expect(probAtLeastOne(0, 200)).toBe(0);
	});

	it('연차가 늘면 단조 증가하고 1을 넘지 않는다', () => {
		let prev = 0;
		for (let n = 1; n <= 500; n++) {
			const p = probAtLeastOne(PICKUP_RATE, n);
			expect(p).toBeGreaterThan(prev);
			expect(p).toBeLessThanOrEqual(1);
			prev = p;
		}
	});
});

describe('expectedPulls', () => {
	it('천장이 없으면 1/p', () => {
		expect(expectedPulls(PICKUP_RATE)).toBeCloseTo(142.857, 3);
	});

	it('천장 200에서 잘린 기대 연차는 107.80 — 109가 아니다 (docs/002)', () => {
		expect(expectedPulls(PICKUP_RATE, PITY)).toBeCloseTo(107.8, 2);
		expect(expectedPulls(PICKUP_RATE, PITY)).toBeLessThan(109);
	});

	it('천장 값은 항상 무천장 값보다 작다', () => {
		expect(expectedPulls(PICKUP_RATE, PITY)).toBeLessThan(expectedPulls(PICKUP_RATE));
	});
});

describe('probAtLeastOneTwoStar — 10연 블록 분기', () => {
	it('10회차 확률이 별도로 적용된다', () => {
		// 1~9회차 1%, 10회차 5% → 1 - 0.99^9 × 0.95
		expect(
			probAtLeastOneTwoStar({ rateNormal: 0.01, rateTenth: 0.05, pulls: 10 })
		).toBeCloseTo(0.1321586, 7);
	});

	it('블록 중간에서 시작하면 10회차를 더 빨리 만난다', () => {
		const fresh = probAtLeastOneTwoStar({ rateNormal: 0.01, rateTenth: 0.5, pulls: 3 });
		const nearTenth = probAtLeastOneTwoStar({
			rateNormal: 0.01,
			rateTenth: 0.5,
			pulls: 3,
			pullsIntoBlock: 8
		});
		expect(nearTenth).toBeGreaterThan(fresh);
	});

	it('보정이 없으면 닫힌 식과 일치한다', () => {
		const r = 0.0185;
		expect(probAtLeastOneTwoStar({ rateNormal: r, rateTenth: r, pulls: 50 })).toBeCloseTo(
			probAtLeastOne(r, 50),
			10
		);
	});
});

describe('pullBudget', () => {
	it('청휘석을 1회 비용으로 나누고 나머지를 남긴다', () => {
		expect(pullBudget({ gems: 24000, costPerPull: COST })).toEqual({
			fromGems: 200,
			fromTickets: 0,
			total: 200,
			leftoverGems: 0
		});
		expect(pullBudget({ gems: 12345, costPerPull: COST })).toMatchObject({
			fromGems: 102,
			leftoverGems: 105
		});
	});

	it('모집권을 더한다', () => {
		const b = pullBudget({
			gems: 1200,
			singleTickets: 3,
			tenPullTickets: 2,
			costPerPull: COST
		});
		expect(b.fromGems).toBe(10);
		expect(b.fromTickets).toBe(23);
		expect(b.total).toBe(33);
	});

	it('10연 할인이 없으면 결과가 같다 (ko 현행 1200 = 120×10)', () => {
		const withTen = pullBudget({ gems: 13000, costPerPull: COST, costPerTenPull: 1200 });
		const withoutTen = pullBudget({ gems: 13000, costPerPull: COST });
		expect(withTen).toEqual(withoutTen);
	});
});

describe('evaluatePity — 포인트 방식', () => {
	const base = {
		system: 'point_exchange' as const,
		pityThreshold: PITY,
		costPerPull: COST
	};

	it('부족분을 연차와 청휘석으로 환산한다', () => {
		const r = evaluatePity({ ...base, currentPoints: 50, availablePulls: 120 });
		expect(r.pullsToPity).toBe(150);
		expect(r.shortfallPulls).toBe(30);
		expect(r.shortfallGems).toBe(3600);
		expect(r.reachable).toBe(false);
	});

	it('충분하면 부족분이 0', () => {
		const r = evaluatePity({ ...base, currentPoints: 50, availablePulls: 200 });
		expect(r.reachable).toBe(true);
		expect(r.shortfallGems).toBe(0);
	});

	it('이미 천장을 넘긴 포인트는 음수가 되지 않는다', () => {
		const r = evaluatePity({ ...base, currentPoints: 220, availablePulls: 0 });
		expect(r.pullsToPity).toBe(0);
		expect(r.reachable).toBe(true);
	});
});

describe('evaluatePity — 차지 방식', () => {
	it('반천장과 천장을 각각 판정한다', () => {
		const r = evaluatePity({
			system: 'charge',
			currentCharge: 40,
			halfThreshold: 100,
			fullThreshold: 200,
			availablePulls: 80,
			costPerPull: COST
		});
		expect(r.half.reachable).toBe(true);
		expect(r.half.pullsTo).toBe(60);
		expect(r.full.reachable).toBe(false);
		expect(r.full.shortfallPulls).toBe(80);
		expect(r.full.shortfallGems).toBe(9600);
	});
});

describe('evaluatePickup', () => {
	it('기획서 3-2의 출력 항목을 한 번에 만든다', () => {
		const result = evaluatePickup({
			budget: { gems: 24000, costPerPull: COST },
			targetRate: PICKUP_RATE,
			pity: { system: 'point_exchange', currentPoints: 0, pityThreshold: PITY }
		});

		expect(result.budget.total).toBe(200);
		expect(result.probability).toBeCloseTo(0.75461, 5);
		expect(result.expectedPulls).toBeCloseTo(107.8, 2);
		expect(result.expectedPullsUncapped).toBeCloseTo(142.857, 3);
		expect(result.pity.system).toBe('point_exchange');
		expect(result.curve.at(-1)?.pulls).toBe(200);
	});

	it('보유 포인트가 있으면 더 적은 연차로 천장에 닿는다', () => {
		const result = evaluatePickup({
			budget: { gems: 12000, costPerPull: COST },
			targetRate: PICKUP_RATE,
			pity: { system: 'point_exchange', currentPoints: 120, pityThreshold: PITY }
		});
		expect(result.budget.total).toBe(100);
		expect(result.pity.system === 'point_exchange' && result.pity.reachable).toBe(true);
	});
});

describe('probabilityCurve', () => {
	it('step을 줘도 끝점이 잘리지 않는다', () => {
		const curve = probabilityCurve(PICKUP_RATE, 200, 7);
		expect(curve[0]).toEqual({ pulls: 0, probability: 0 });
		expect(curve.at(-1)?.pulls).toBe(200);
	});
});
