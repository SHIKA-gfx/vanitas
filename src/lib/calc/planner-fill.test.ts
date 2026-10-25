import { describe, expect, it } from 'vitest';
import { createShortfallFiller, fillShortfall, type FillLever } from './planner-fill';
import { planFromData, type PlannerIncomeInput, type PlannerQuery } from './planner-adapter';

/** 무료 보상을 하나도 받지 않고 AP를 사는 사람 — 바꿀 수 있는 무료 방법이 모두 남아 있다 */
const NOTHING: PlannerIncomeInput = {
	included: [],
	tacticalDaily: 20,
	raidTier: 'bronze',
	participation: 'none',
	subscriptions: { 'monthly-pass': 0, 'half-pass': 0 },
	apPurchasesPerDay: 3
};

const ALL_FREE = [
	'daily-mission',
	'weekly-mission',
	'arona-attendance',
	'tactical-tournament',
	'raid-score',
	'raid-rank',
	'raid-daily-entry',
	'eliminate-raid-score',
	'eliminate-raid-reward',
	'eliminate-raid-daily-entry',
	'event'
];

/** 무료로 바꿀 수 있는 것이 없는 사람 (등급·참여도·전술대회 순위 맨 위, AP 구매 없음) */
const MAXED: PlannerIncomeInput = {
	included: ALL_FREE,
	tacticalDaily: 45,
	raidTier: 'platinum',
	participation: 'full',
	subscriptions: { 'monthly-pass': 0, 'half-pass': 0 },
	apPurchasesPerDay: 0
};

const TODAY = '2026-10-25';
const CRUISE = { recruitId: '2026-11-17-pandemonium-cruise', studentId: 'makoto_swimsuit' };
const FES = { recruitId: '2026-11-24-fes-5-5th', studentId: 'rio' };
const NATSUZORA = { recruitId: '2026-12-29-natsuzora-rerun', studentId: 'seia_swimsuit' };

function query(over: Partial<PlannerQuery>): PlannerQuery {
	return {
		today: TODAY,
		targets: [],
		gems: 0,
		singleTickets: 0,
		tenPullTickets: 0,
		stacks: {},
		mileage: 0,
		income: NOTHING,
		...over
	};
}

/** 단계의 바꾸기를 수급 조건에 그대로 적용한다 (화면이 "수급 계산기에서 바꾸기"로 보내는 값) */
function apply(income: PlannerIncomeInput, lever: FillLever): PlannerIncomeInput {
	switch (lever.kind) {
		case 'source': {
			const next = { ...income, included: [...income.included, lever.id] };
			if (lever.participation === '절반') next.participation = 'half';
			if (lever.participation === '완주') next.participation = 'full';
			return next;
		}
		case 'tacticalRank':
			return { ...income, tacticalDaily: lever.to };
		case 'raidTier':
			return {
				...income,
				raidTier: { 실버: 'silver', 골드: 'gold', 플래티넘: 'platinum' }[lever.to]!
			};
		case 'participation':
			return { ...income, participation: lever.to === '완주' ? 'full' : 'half' };
		case 'apPurchases':
			return { ...income, apPurchasesPerDay: 0 };
		case 'subscription':
			return { ...income, subscriptions: { ...income.subscriptions, [lever.id]: lever.to } };
	}
}

function outcomeOf(q: PlannerQuery, i: number) {
	const r = planFromData(q, { alternatives: false });
	if (r.kind !== 'ok') throw new Error(r.kind);
	return r.result.outcomes[i];
}

describe('fillShortfall — 언제 계산하나', () => {
	it('확보·불가 목표에는 메우는 방법이 없다', () => {
		expect(fillShortfall(query({ gems: 99999, targets: [FES] }), 0)).toBeNull();
		// 끝난 기간 (저장·공유된 낡은 목표)
		const ended = query({ today: '2026-11-20', targets: [CRUISE, FES] });
		expect(outcomeOf(ended, 0).kind).toBe('short');
		expect(
			fillShortfall(
				{
					...ended,
					targets: [{ recruitId: '2026-11-10-serenade-permanent', studentId: 'chiaki' }]
				},
				0
			)
		).toBeNull();
	});

	it('수급 입력이 잘못되면 계산하지 않는다', () => {
		const bad = query({ targets: [FES], income: { ...NOTHING, raidTier: 'diamond' } });
		expect(fillShortfall(bad, 0)).toBeNull();
	});
});

describe('fillShortfall — 무료 방법', () => {
	const q = query({ gems: 15000, targets: [FES] });
	const fill = fillShortfall(q, 0)!;

	it('무료 방법만으로 확보되면 그 단계에서 멈춘다', () => {
		expect(fill.securedAt).toBe(fill.steps.length - 1);
		expect(fill.remaining).toBe(0);
		expect(fill.steps.every((s) => s.kind === 'free')).toBe(true);
		// 마지막 단계 직전까지는 아직 부족, 부족은 단계마다 줄어든다
		const remaining = fill.steps.map((s) => s.remainingAfter);
		expect(remaining.at(-1)).toBe(0);
		for (let i = 1; i < remaining.length; i++) expect(remaining[i]).toBeLessThan(remaining[i - 1]);
	});

	it('효과가 큰 순서로 고른다 — 이 경우 AP 구매 줄이기가 먼저', () => {
		expect(fill.steps[0].lever).toEqual({ kind: 'apPurchases', from: 3 });
		const worth = fill.steps.map((s) => s.gainGems + s.gainTickets * 1200);
		for (const w of worth) expect(w).toBeGreaterThan(0);
		for (let i = 1; i < worth.length; i++) expect(worth[i]).toBeLessThanOrEqual(worth[i - 1]);
	});

	it('다시 돌린 결과와 같다 — 단계를 모두 적용하면 확보, 마지막 하나를 빼면 부족', () => {
		const levers = fill.steps.map((s) => s.lever);
		const all = levers.reduce(apply, NOTHING);
		expect(outcomeOf({ ...q, income: all }, 0).kind).toBe('secured');
		const butLast = levers.slice(0, -1).reduce(apply, NOTHING);
		expect(outcomeOf({ ...q, income: butLast }, 0)).toMatchObject({
			kind: 'short',
			shortfallGems: fill.steps.at(-2)!.remainingAfter
		});
	});

	it('이벤트를 받지 않고 참여도가 "미참여"면, 켜기와 참여도 한 단계를 한 방법으로 본다', () => {
		const event = fill.steps.find((s) => s.lever.kind === 'source' && s.lever.id === 'event');
		expect(event?.lever).toMatchObject({ participation: '절반' });
		// 참여도는 이미 한 단계 올렸으므로 따로 또 올리지 않는다
		expect(fill.steps.some((s) => s.lever.kind === 'participation')).toBe(false);
	});

	it('10회 모집 티켓으로 받는 보상도 그 픽업까지 받는 장수로 센다 (1장 = 10연 = 1,200개로 비교)', () => {
		const ticket = fill.steps.find(
			(s) => s.lever.kind === 'source' && s.lever.id === 'eliminate-raid-reward'
		)!;
		expect(ticket).toMatchObject({ gainGems: 0, gainTickets: 1 });
		const i = fill.steps.indexOf(ticket);
		expect(fill.steps[i - 1].remainingAfter - ticket.remainingAfter).toBe(1200);
	});
});

describe('fillShortfall — 한 단계 위', () => {
	it('전술대회는 지금 일일 보상보다 많은 첫 순위 금액으로 올린다 (20 → 25개, 101~200위)', () => {
		// 다른 무료 방법은 다 쓴 상태라 전술대회만 남는다. 138개 부족 — 25개 × 36일이면 메워진다
		const q = query({ gems: 9300, targets: [FES], income: { ...MAXED, tacticalDaily: 20 } });
		const fill = fillShortfall(q, 0)!;
		expect(fill.securedAt).toBe(0);
		expect(fill.steps[0]).toMatchObject({
			kind: 'free',
			lever: { kind: 'tacticalRank', from: 20, to: 25, rank: '101~200위' },
			gainGems: 180
		});
	});

	it('한 단계만 올린다 — 모자라도 두 번 올리지 않는다', () => {
		const q = query({ gems: 5000, targets: [FES], income: { ...MAXED, tacticalDaily: 20 } });
		const fill = fillShortfall(q, 0)!;
		expect(fill.steps.filter((s) => s.lever.kind === 'tacticalRank')).toHaveLength(1);
	});

	it('이미 1위(45개)면 전술대회는 더 올리지 않는다', () => {
		const fill = fillShortfall(query({ gems: 8000, targets: [FES], income: MAXED }), 0)!;
		expect(fill.steps.length).toBeGreaterThan(0);
		expect(fill.steps.every((s) => s.kind === 'paid')).toBe(true);
	});
});

describe('fillShortfall — 과금과 한계', () => {
	it('무료로 모자라면 정액 상품을 이어서 더한다 — 과금은 무료 뒤에만', () => {
		const q = query({ gems: 5000, targets: [FES], income: { ...MAXED, participation: 'half' } });
		const fill = fillShortfall(q, 0)!;
		const kinds = fill.steps.map((s) => s.kind);
		expect(kinds[0]).toBe('free');
		const firstPaid = kinds.indexOf('paid');
		expect(firstPaid).toBeGreaterThan(0);
		expect(kinds.slice(firstPaid).every((k) => k === 'paid')).toBe(true);
		// 그 픽업(11/24~11/30 뽑기, 36일째)까지 받으려면 30일 상품 2회
		expect(fill.steps[firstPaid].lever).toMatchObject({ kind: 'subscription', from: 0, to: 2 });
	});

	it('정액 상품으로 확보되면, 확보되는 가장 적은 구매 횟수로 줄인다', () => {
		// 무료는 다 받고 있고, 월정액 1회면 충분한 정도로 모자라다
		const base = query({ gems: 7900, targets: [FES], income: MAXED });
		const short = outcomeOf(base, 0);
		expect(short.kind).toBe('short');
		const fill = fillShortfall(base, 0)!;
		expect(fill.securedAt).toBe(0);
		const step = fill.steps[0];
		expect(step.lever).toMatchObject({ kind: 'subscription', id: 'monthly-pass', from: 0, to: 1 });
	});

	it('다 바꿔도 모자라면 남은 부족분을 알린다', () => {
		const q = query({
			gems: 0,
			targets: [CRUISE],
			income: {
				...MAXED,
				subscriptions: { 'monthly-pass': 'continuous', 'half-pass': 'continuous' }
			}
		});
		const fill = fillShortfall(q, 0)!;
		const before = outcomeOf(q, 0);
		expect(fill.steps).toEqual([]);
		expect(fill.securedAt).toBeNull();
		expect(fill.remaining).toBe(before.kind === 'short' ? before.shortfallGems : -1);
	});
});

describe('fillShortfall — 다른 목표와의 관계', () => {
	const q = query({ gems: 15000, targets: [CRUISE, FES, NATSUZORA] });

	it('도중에 함께 확보되는 목표와, 이 목표가 확보되며 밀려나는 목표를 알린다', () => {
		const fill = fillShortfall(q, 0)!;
		expect(fill.securedAt).not.toBeNull();
		const also = fill.steps.flatMap((s) => s.alsoSecured);
		// 3순위(12월 말)가 먼저 확보됐다가, 1순위가 확보되며 밀려난다 — 밀려난 목표의 새 부족분도 함께
		expect(also).toContain(2);
		const lost = fill.steps.at(-1)!.alsoLost;
		expect(lost.map((l) => l.index)).toEqual([2]);
		const levers = fill.steps.map((s) => s.lever);
		const after = outcomeOf({ ...q, income: levers.reduce(apply, NOTHING) }, 2);
		expect(after).toMatchObject({ kind: 'short', shortfallGems: lost[0].shortfallGems });
	});

	it('한 계산기로 여러 목표를 계산해도 따로 계산한 것과 같다', () => {
		const filler = createShortfallFiller(q);
		for (const i of [0, 1, 2]) expect(filler(i)).toEqual(fillShortfall(q, i));
	});
});
