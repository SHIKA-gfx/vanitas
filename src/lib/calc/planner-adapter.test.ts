import { describe, expect, it } from 'vitest';
import { listPlannerChoices, planFromData, type PlannerQuery } from './planner-adapter';

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
		expect(periods[0].recruit.id).toBe('2026-11-10-serenade-permanent');
		const fes = periods.find((p) => p.recruit.id === '2026-11-24-fes-5-5th')!;
		expect(fes.choices.map((c) => [c.studentId, c.stack.name])).toEqual([
			['ibuki_swimsuit', '특별 스택'],
			['iroha_swimsuit', '특별 스택'],
			['neru_uniform', '특별 스택'],
			['rio', '특별 스택']
		]);
	});

	it('페스의 픽업 외 학생은 고를 수 없고 따로 보여준다', () => {
		const fes = listPlannerChoices(TODAY).find((p) => p.recruit.id === '2026-11-24-fes-5-5th')!;
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
		expect(ids).not.toContain('2026-11-10-serenade-permanent');
		expect(ids[0]).toBe('2026-11-17-pandemonium-cruise');
	});
});

describe('planFromData', () => {
	it('보유 19,200개로 페스 한 명 확정 — 기간 마지막 날(11/30)에 뽑는다', () => {
		const r = planFromData(
			query({ gems: 19200, targets: [{ recruitId: '2026-11-24-fes-5-5th', studentId: 'rio' }] })
		);
		expect(r.kind).toBe('ok');
		if (r.kind !== 'ok') return;
		expect(r.result.outcomes[0]).toMatchObject({ kind: 'secured', stackStart: 0 });
		expect(r.result.periods[0]).toMatchObject({ day: 29, gemPulls: 160, mileagePulls: 40 });
		expect(r.scheduleEstimated).toBe(true);
		expect(r.scheduleVerifiedAt).toBe('2026-10-25');
		expect(r.mileageAssumed).toBe(true);
	});

	it('특별 스택 이월: 만마선에서 확정하면 페스 목표는 0에서 시작한다', () => {
		const r = planFromData(
			query({
				gems: 99999,
				stacks: { limited: 120 },
				targets: [
					{ recruitId: '2026-11-17-pandemonium-cruise', studentId: 'makoto_swimsuit' },
					{ recruitId: '2026-11-24-fes-5-5th', studentId: 'rio' }
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
				targets: [{ recruitId: '2026-11-10-serenade-permanent', studentId: 'chiaki' }]
			})
		);
		expect(r.kind === 'ok' && r.result.outcomes[0]).toMatchObject({
			stackStart: 150,
			pullsToPity: 50
		});
	});

	it('무료 모집이 있는 기간은 계산에 넣지 않았다고 알린다', () => {
		const r = planFromData(query({}));
		expect(r.kind === 'ok' && r.freePullsIgnored).toEqual(['2026-11-17-pandemonium-cruise']);
	});

	it('고를 수 없는 목표(끝난 기간)는 unavailable', () => {
		const r = planFromData(
			query({
				today: '2026-11-20',
				targets: [{ recruitId: '2026-11-10-serenade-permanent', studentId: 'chiaki' }]
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
