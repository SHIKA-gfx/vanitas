import { describe, expect, it } from 'vitest';
import { getBannerType, getGameConfig, getSchedule } from '$lib/data';
import type { PlannerGoal } from './planner';
import {
	goalPullsRange,
	listPlannerChoices,
	planFromData,
	type PlannerChoice,
	type PlannerQuery
} from './planner-adapter';

/** 수급 없음 — 보유분만으로 계산해 결과를 손으로 셀 수 있게 한다 */
const NO_INCOME: PlannerQuery['income'] = {
	included: [],
	tacticalDaily: 0,
	raidTier: 'gold',
	participation: 'full',
	subscriptions: {},
	apPurchasesPerDay: 0
};

const TODAY = '2026-11-01';

function query(over: Partial<PlannerQuery>): PlannerQuery {
	return {
		today: TODAY,
		targets: [],
		gems: 0,
		singleTickets: 0,
		tenPullTickets: 0,
		stacks: {},
		mileage: 0,
		income: NO_INCOME,
		...over
	};
}

describe('listPlannerChoices', () => {
	it('오늘 이후에 끝나는 기간의 픽업 학생을 기간 순으로', () => {
		const periods = listPlannerChoices(TODAY);
		expect(periods[0].recruit.id).toBe('2026-11-10-pandemonium-cruise');
		const fes = periods.find((p) => p.recruit.id === '2026-11-17-fes-5-5th')!;
		expect(fes.choices.map((c) => [c.studentId, c.stack.name])).toEqual([
			['ibuki_swimsuit', '특별 스택'],
			['iroha_swimsuit', '특별 스택'],
			['neru_uniform', '특별 스택'],
			['rio', '특별 스택']
		]);
	});

	it('페스의 픽업 외 학생은 고를 수 없고 따로 보여준다', () => {
		const fes = listPlannerChoices(TODAY).find((p) => p.recruit.id === '2026-11-17-fes-5-5th')!;
		expect(fes.offPickup.map((s) => s.id)).toEqual([
			'hoshino_battle',
			'shiroko_terror',
			'nagisa_swimsuit',
			'mika_swimsuit',
			'aris_battle',
			'kei'
		]);
		const choiceIds = fes.choices.map((c) => c.studentId);
		for (const s of fes.offPickup) expect(choiceIds).not.toContain(s.id);
	});

	it('끝난 기간은 빠진다', () => {
		const ids = listPlannerChoices('2026-11-20').map((p) => p.recruit.id);
		expect(ids).not.toContain('2026-11-10-pandemonium-cruise');
		expect(ids[0]).toBe('2026-11-17-fes-5-5th');
	});
});

describe('planFromData', () => {
	it('보유 19,200개로 페스 한 명 확정 — 기간 마지막 날(11/23)에 뽑는다', () => {
		const r = planFromData(
			query({ gems: 19200, targets: [{ recruitId: '2026-11-17-fes-5-5th', studentId: 'rio' }] })
		);
		expect(r.kind).toBe('ok');
		if (r.kind !== 'ok') return;
		expect(r.result.outcomes[0]).toMatchObject({ kind: 'secured', stackStart: 0 });
		expect(r.result.periods[0]).toMatchObject({ day: 22, gemPulls: 160, mileagePulls: 40 });
		// 12월 이후 기간이 추정이라 미래시 전체로는 추정. 마일리지 초회 범위는 기간마다로 확인 (2026-11-10)
		expect(r.scheduleEstimated).toBe(true);
		// 일정 확인일은 데이터의 미래시 확인일 그대로 — 관리자 화면에서 기간을 저장할 때마다 바뀌므로 날짜를 적어 두지 않는다
		expect(r.scheduleVerifiedAt).toBe(getSchedule().meta.recruitsVerifiedAt);
		expect(r.scheduleVerifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		expect(r.mileageAssumed).toBe(false);
	});

	it('특별 스택 이월: 만마선에서 확정하면 페스 목표는 0에서 시작한다', () => {
		const r = planFromData(
			query({
				gems: 99999,
				stacks: { limited: 120 },
				targets: [
					{ recruitId: '2026-11-10-pandemonium-cruise', studentId: 'makoto_swimsuit' },
					{ recruitId: '2026-11-17-fes-5-5th', studentId: 'rio' }
				]
			})
		);
		expect(
			r.kind === 'ok' && r.result.outcomes.map((o) => o.kind !== 'unavailable' && o.stackStart)
		).toEqual([120, 0]);
	});

	it('모집 스택과 특별 스택은 따로 — 통상 픽업 목표는 모집 스택에서', () => {
		const r = planFromData(
			query({
				gems: 99999,
				stacks: { normal: 150, limited: 30 },
				targets: [{ recruitId: '2026-11-24-pandemic-hazard-rerun', studentId: 'sena_casual' }]
			})
		);
		expect(r.kind === 'ok' && r.result.outcomes[0]).toMatchObject({
			stackStart: 150,
			pullsToPity: 50
		});
	});

	it('무료 모집을 계산에 넣는다 — 만마선 목표는 무료 200회로 청휘석 없이 확정 (2026-11-10)', () => {
		const r = planFromData(
			query({
				targets: [{ recruitId: '2026-11-10-pandemonium-cruise', studentId: 'makoto_swimsuit' }]
			})
		);
		expect(r.kind).toBe('ok');
		if (r.kind !== 'ok') return;
		expect(r.freePullsCounted).toEqual(['2026-11-10-pandemonium-cruise']);
		expect(r.freePullsIgnored).toEqual([]);
		expect(r.result.outcomes[0].kind).toBe('secured');
		expect(r.result.periods[0]).toMatchObject({ pulls: 200, freePulls: 200, gemPulls: 0 });
	});

	it('진행 중인 기간은 남은 무료 모집만 쓴다', () => {
		// 11/12, 무료 모집 20회 남음, 특별 스택 150 → 50연 중 20연 무료, 30연은 청휘석 (마일리지 0이라 티켓 없음)
		const r = planFromData(
			query({
				today: '2026-11-12',
				gems: 99999,
				stacks: { limited: 150 },
				freePullsLeft: { '2026-11-10-pandemonium-cruise': 20 },
				targets: [{ recruitId: '2026-11-10-pandemonium-cruise', studentId: 'makoto_swimsuit' }]
			})
		);
		expect(r.kind === 'ok' && r.result.periods[0]).toMatchObject({
			pulls: 50,
			freePulls: 20,
			gemPulls: 30
		});
	});

	it('고를 수 없는 목표(끝난 기간)는 unavailable', () => {
		const r = planFromData(
			query({
				today: '2026-11-20',
				targets: [{ recruitId: '2026-11-10-pandemonium-cruise', studentId: 'makoto_swimsuit' }]
			})
		);
		expect(r.kind === 'ok' && r.result.outcomes[0]).toMatchObject({
			kind: 'unavailable',
			reason: 'period_ended'
		});
	});

	it('미래시가 모두 끝났으면 no_recruits', () => {
		expect(planFromData(query({ today: '2027-12-01' })).kind).toBe('no_recruits');
	});

	it('수급 입력이 잘못되면 그 칸을 알려준다', () => {
		const r = planFromData(query({ income: { ...NO_INCOME, apPurchasesPerDay: -1 } }));
		expect(r).toEqual({ kind: 'invalid_income', field: 'apPurchasesPerDay' });
	});
});

describe('목표 종류 (v0.3, docs/007 10장)', () => {
	const choices = listPlannerChoices(TODAY).flatMap((p) => p.choices);
	const targetOf = (c: PlannerChoice, goal?: PlannerGoal) => ({
		recruitId: c.recruitId,
		studentId: c.studentId,
		...(goal ? { goal } : {})
	});
	const firstOutcome = (q: PlannerQuery) => {
		const r = planFromData(q, { alternatives: false });
		if (r.kind !== 'ok') throw new Error(r.kind);
		return r.result.outcomes[0];
	};

	it('픽업 학생이 여럿인 배너는 확정만 고른다 (반천장 규칙 검증 필요), 한 명이면 세 종류', () => {
		const recruits = getSchedule().recruits;
		for (const c of choices) {
			const banner = recruits
				.find((r) => r.id === c.recruitId)!
				.banners.find((b) => b.type === c.bannerType && b.students.includes(c.studentId))!;
			expect(c.pickupCount).toBe(banner.students.length);
			if (banner.students.length > 1) {
				expect(c.goalKinds).toEqual(['pity']);
				expect(c.goalLock).toBe('multi_pickup');
			} else {
				expect(c.goalKinds).toEqual(['pity', 'half', 'pulls']);
				expect(c.goalLock).toBeNull();
			}
		}
	});

	it('1회 확률이 확인된 값인지는 배너 종류의 픽업 그룹을 따른다 (아니면 화면이 "추정 확률")', () => {
		for (const c of choices) {
			const groups = getBannerType(c.bannerType).rateGroups.default ?? [];
			const group = groups.find((g) => g.poolRef === 'pickup')!;
			expect(c.rateVerified).toBe(group.verified);
		}
	});

	it('반천장까지를 넘긴다 — 스택 0에서 반천장까지, 도전', () => {
		const single = choices.find((c) => c.goalLock === null)!;
		const o = firstOutcome(query({ gems: 99999, targets: [targetOf(single, { kind: 'half' })] }));
		expect(o).toMatchObject({
			kind: 'attempt',
			goal: 'half',
			stackStart: 0,
			pulls: getGameConfig().chargeSystem.softPity.count
		});
	});

	it('확정만 고를 수 있는 목표에 다른 종류가 오면 확정으로 계산한다', () => {
		const multi = choices.find((c) => c.goalLock === 'multi_pickup');
		if (!multi) return; // 지금 미래시에 그런 배너가 없으면 볼 것이 없다
		const o = firstOutcome(query({ gems: 99999, targets: [targetOf(multi, { kind: 'half' })] }));
		expect(o).toMatchObject({ kind: 'secured', goal: 'pity' });
	});

	it('틀린 연 수(0, 소수)는 확정으로 계산한다 — 저장·공유된 값이 낡아도 멈추지 않는다', () => {
		const single = choices.find((c) => c.goalLock === null)!;
		for (const n of [0, 2.5, -3]) {
			const o = firstOutcome(
				query({ gems: 99999, targets: [targetOf(single, { kind: 'pulls', pulls: n })] })
			);
			expect(o).toMatchObject({ kind: 'secured', goal: 'pity' });
		}
	});

	it('N연의 범위는 1 ~ (천장 − 1), 천장은 game-config', () => {
		expect(goalPullsRange()).toEqual({
			min: 1,
			max: getGameConfig().chargeSystem.hardPity.count - 1
		});
	});
});
