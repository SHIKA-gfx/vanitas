import { describe, expect, it } from 'vitest';
import { getBannerType } from '$lib/data';
import {
	bannerAvailability,
	defaultTargetGroup,
	evaluateBanner,
	listTargetGroups
} from './gacha-adapter';

/**
 * 실제 data/ko JSON을 읽는 통합 테스트.
 * 풀 크기가 바뀌어도 깨지지 않도록 스냅샷 기준일(asOf)을 고정한다.
 */

const AS_OF = '2026-09-19';

describe('defaultTargetGroup', () => {
	it('픽업 모집은 픽업 그룹을 고른다', () => {
		const target = defaultTargetGroup(getBannerType('pickup_normal'));
		expect(target?.poolRef).toBe('pickup');
		expect(target?.rate).toBe(0.7);
	});

	it('목표 후보는 ★3 그룹만', () => {
		for (const g of listTargetGroups(getBannerType('pickup_normal'))) {
			expect(g.rarity).toBe(3);
		}
	});
});

describe('evaluateBanner', () => {
	it('픽업 모집: 0.7%, 천장 200, 24000 청휘석 = 200연', () => {
		const r = evaluateBanner({
			bannerId: 'pickup_normal',
			gems: 24000,
			currentPoints: 0,
			asOf: AS_OF
		});
		expect(r.ok).toBe(true);
		if (!r.ok) return;

		expect(r.ratePercent).toBeCloseTo(0.7, 10);
		expect(r.evaluation.budget.total).toBe(200);
		expect(r.evaluation.pity.system).toBe('point_exchange');
		if (r.evaluation.pity.system === 'point_exchange') {
			expect(r.evaluation.pity.pullsToPity).toBe(200);
			expect(r.evaluation.pity.reachable).toBe(true);
		}
		expect(r.evaluation.expectedPulls).toBeCloseTo(107.8, 2);
	});

	it('상시 모집: 3.0% ÷ 109명 (2026-09-19 스냅샷)', () => {
		const r = evaluateBanner({
			bannerId: 'standard',
			gems: 0,
			currentPoints: 0,
			asOf: AS_OF
		});
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		expect(r.target.poolRef).toBe('standard_3s');
		expect(r.ratePercent).toBeCloseTo(3.0 / 109, 10);
	});

	it('없는 목표 그룹 id는 no_target_group', () => {
		const r = evaluateBanner({
			bannerId: 'pickup_normal',
			targetGroupId: '__none__',
			gems: 0,
			currentPoints: 0
		});
		expect(r).toMatchObject({ ok: false, reason: 'no_target_group' });
	});
});

describe('bannerAvailability', () => {
	it('계산할 수 있는 배너는 null', () => {
		expect(bannerAvailability('pickup_normal', { asOf: AS_OF })).toBeNull();
		expect(bannerAvailability('standard', { asOf: AS_OF })).toBeNull();
	});

	it('evaluateBanner와 같은 이유를 돌려준다', () => {
		for (const id of ['pickup_normal', 'standard', 'archive']) {
			const r = evaluateBanner({ bannerId: id, gems: 0, currentPoints: 0, asOf: AS_OF });
			expect(bannerAvailability(id, { asOf: AS_OF })).toBe(r.ok ? null : r.reason);
		}
	});
});

