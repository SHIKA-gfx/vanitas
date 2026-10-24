import { describe, expect, it } from 'vitest';
import {
	getGameConfig,
	getPerUnitRate,
	getNextPitySystem,
	getPityRule,
	getPitySystem,
	getPoolEntry,
	getRateGroups,
	getStudent,
	listBannerTypes,
	listRecruits
} from './index';

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
	it('한국 포인트 방식은 픽업 획득 시 초기화되지 않는다', () => {
		const c = getGameConfig();
		expect(c.recruitPoint.resetOnPickupObtained).toBe(false);
		expect(c.recruitPoint.pityThreshold).toBe(200);
	});

	it('2026-11-10부터 모집 스택 방식이다 (경계 전날·당일)', () => {
		expect(getPitySystem('2026-11-09').system).toBe('point_exchange');
		expect(getPitySystem('2026-11-10').system).toBe('charge');
		expect(getPitySystem('2027-01-01').system).toBe('charge');
	});

	it('다음 전환: 전날까지는 2026-11-10 스택, 당일부터는 없음', () => {
		expect(getNextPitySystem('2026-10-23')).toMatchObject({
			system: 'charge',
			effectiveFrom: '2026-11-10'
		});
		expect(getNextPitySystem('2026-11-09')?.effectiveFrom).toBe('2026-11-10');
		expect(getNextPitySystem('2026-11-10')).toBeNull();
	});

	it('서비스 개시 전 날짜는 규칙이 없다', () => {
		expect(() => getPitySystem('2021-01-01')).toThrow();
	});

	it('스택은 픽업 획득 시 초기화되고 기간을 넘어 이월된다', () => {
		const c = getGameConfig().chargeSystem;
		expect(c.softPity).toMatchObject({ count: 100, pickupChance: 0.5 });
		expect(c.hardPity.count).toBe(200);
		expect(c.resetOnPickupObtained).toBe(true);
		expect(c.carryOver).toBe(true);
		expect(c.sharedBetweenTypes).toBe(false);
	});

	it('마일리지 10회 모집 티켓은 8장이며 오름차순이다', () => {
		const at = getGameConfig().chargeSystem.mileage.tenPullTicketAt;
		expect(at).toEqual([70, 130, 150, 170, 270, 330, 350, 370]);
	});
});

describe('getPityRule', () => {
	const AFTER = '2026-11-10';

	it('전환 전에는 모든 천장 배너가 포인트 풀을 쓴다', () => {
		const r = getPityRule('pickup_normal', '2026-11-09');
		expect(r.kind === 'point' && r.pool.id).toBe('recruit');
	});

	it('전환 후 픽업은 모집 스택, 특별·페스는 특별 스택', () => {
		const pick = (id: string) => {
			const r = getPityRule(id, AFTER);
			return r.kind === 'charge' ? r.chargeType.name : r.kind;
		};
		expect(pick('pickup_normal')).toBe('모집 스택');
		expect(pick('pickup_limited')).toBe('특별 스택');
		expect(pick('fes')).toBe('특별 스택');
	});

	it('아카이브는 전환 후에도 포인트, 선별 모집은 천장 없음', () => {
		const archive = getPityRule('archive', AFTER);
		expect(archive.kind === 'point' && archive.pool.id).toBe('archive');
		expect(getPityRule('selection', AFTER)).toMatchObject({ kind: 'none', reason: 'no_pity' });
	});

	it('미확인 배너는 rule_unconfirmed', () => {
		for (const id of getGameConfig().chargeSystem.unconfirmedBanners) {
			expect(getPityRule(id, AFTER), id).toMatchObject({ kind: 'none', reason: 'rule_unconfirmed' });
		}
	});
});
describe('픽업 미래시 (플래너)', () => {
	it('모든 픽업 기간은 모집 스택 전환 이후이고 시작일 오름차순이다', () => {
		const rows = listRecruits();
		expect(rows.length).toBeGreaterThan(0);
		for (const r of rows) expect(getPitySystem(r.start).system).toBe('charge');
		const starts = rows.map((r) => r.start);
		expect(starts).toEqual([...starts].sort());
	});

	it('from 이후에 끝나는 기간만 고른다', () => {
		const all = listRecruits();
		const later = listRecruits({ from: all[0].end });
		expect(later.length).toBe(all.length - 1);
	});

	it('배너의 학생은 모두 찾을 수 있고, 배너 종류로 스택이 정해진다', () => {
		for (const r of listRecruits()) {
			for (const b of r.banners) {
				for (const id of b.students) expect(getStudent(id).id).toBe(id);
				expect(getPityRule(b.type, r.start).kind, `${r.id} ${b.type}`).toBe('charge');
			}
		}
	});

	it('가칭 학생은 koNameStatus로 구분한다', () => {
		expect(getStudent('makoto_swimsuit').koNameStatus).toBe('provisional');
		expect(getStudent('rio').koNameStatus).toBe('official');
	});
});
