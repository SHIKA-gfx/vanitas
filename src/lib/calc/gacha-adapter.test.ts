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
/** 규칙을 고르는 게임 날짜. 실행 날짜에 따라 결과가 바뀌지 않도록 고정한다 */
const BEFORE = '2026-11-09'; // 포인트 방식 마지막 날
const AFTER = '2026-11-10'; // 모집 스택 첫날

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
			date: BEFORE,
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
			date: BEFORE,
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
			date: BEFORE,
			targetGroupId: '__none__',
			gems: 0,
			currentPoints: 0
		});
		expect(r).toMatchObject({ ok: false, reason: 'no_target_group' });
	});
});

describe('bannerAvailability', () => {
	it('계산할 수 있는 배너는 null', () => {
		expect(bannerAvailability('pickup_normal', { date: BEFORE, asOf: AS_OF })).toBeNull();
		expect(bannerAvailability('standard', { date: BEFORE, asOf: AS_OF })).toBeNull();
	});

	it('evaluateBanner와 같은 이유를 돌려준다', () => {
		for (const date of [BEFORE, AFTER]) {
			for (const id of ['pickup_normal', 'standard', 'archive', 'recollect']) {
				const r = evaluateBanner({ bannerId: id, date, gems: 0, currentPoints: 0, asOf: AS_OF });
				expect(bannerAvailability(id, { date, asOf: AS_OF })).toBe(r.ok ? null : r.reason);
			}
		}
	});
});

describe('모집 스택 전환 (2026-11-10)', () => {
	const query = { gems: 24000, currentPoints: 0, asOf: AS_OF };

	it('전환일부터 픽업 모집은 스택 방식으로 계산한다', () => {
		const before = evaluateBanner({ bannerId: 'pickup_normal', date: BEFORE, ...query });
		const after = evaluateBanner({ bannerId: 'pickup_normal', date: AFTER, ...query });
		expect(before.ok && before.evaluation.pity.system).toBe('point_exchange');
		expect(after.ok && after.evaluation.pity.system).toBe('charge');
	});

	it('아카이브 모집은 전환 뒤에도 아카이브 포인트를 쓴다', () => {
		const r = evaluateBanner({ bannerId: 'archive', date: AFTER, ...query });
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		expect(r.evaluation.pity.system).toBe('point_exchange');
	});

	it('스택 방식은 마일리지 티켓을 더해 19,200개로 확정, 마일리지 가정을 표시한다', () => {
		const r = evaluateBanner({
			bannerId: 'pickup_normal',
			date: AFTER,
			gems: 19200,
			currentPoints: 0,
			asOf: AS_OF
		});
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		expect(r.evaluation.budget).toMatchObject({ fromMileage: 40, total: 200 });
		expect(r.evaluation.verdict).toMatchObject({ kind: 'guaranteed', leftoverGemsAtPity: 0 });
		expect(r.mileageAssumed).toBe(true);
	});

	it('이번 기간 마일리지를 넘기면 이미 받은 티켓은 빼고 센다', () => {
		const r = evaluateBanner({
			bannerId: 'pickup_normal',
			date: AFTER,
			gems: 0,
			currentPoints: 0,
			mileage: 380,
			asOf: AS_OF
		});
		expect(r.ok && r.evaluation.verdict).toMatchObject({ kind: 'short', shortfallGems: 24000 });
		// 남은 티켓이 없으니 마일리지 가정에 기대지 않는다
		expect(r.ok && r.mileageAssumed).toBe(false);
	});

	it('범위를 넘는 스택은 천장 직전으로 자른다 (계산이 던지지 않게)', () => {
		const r = evaluateBanner({
			bannerId: 'pickup_normal',
			date: AFTER,
			gems: 0,
			currentPoints: 250,
			asOf: AS_OF
		});
		expect(r.ok && r.evaluation.verdict).toMatchObject({ kind: 'short', pullsToPity: 1 });
	});

	it('포인트 방식(전환 전·아카이브)은 마일리지 가정이 없다', () => {
		const before = evaluateBanner({ bannerId: 'pickup_normal', date: BEFORE, ...query });
		const archive = evaluateBanner({ bannerId: 'archive', date: AFTER, ...query });
		expect(before.ok && before.mileageAssumed).toBe(false);
		expect(archive.ok && archive.mileageAssumed).toBe(false);
	});

	it('규칙이 공지되지 않은 상시·리콜렉트는 전환 뒤 rule_unconfirmed', () => {
		for (const id of ['standard', 'recollect']) {
			expect(bannerAvailability(id, { date: AFTER, asOf: AS_OF })).toBe('rule_unconfirmed');
		}
	});
});
