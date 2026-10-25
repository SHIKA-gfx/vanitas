import { describe, expect, it } from 'vitest';
import { planPickups, spendInPeriod, type PlannerInput, type PlannerTarget } from './planner';

const RULE = { half: 100, halfPickupChance: 0.5, full: 200 };
const MILEAGE = { ticketAt: [70, 130, 150, 170, 270, 330, 350, 370], pullsPerTicket: 10 };
const flat = (gems: number, days = 30) => new Array<number>(days).fill(gems);

/** 기간 세 개: 오늘~6일 / 7~13일 / 14~20일 (endDay 미포함) */
const PERIODS = [
	{ id: 'p1', startDay: 0, endDay: 7 },
	{ id: 'p2', startDay: 7, endDay: 14 },
	{ id: 'p3', startDay: 14, endDay: 21 }
];

const target = (id: string, periodId: string, stackType: string): PlannerTarget => ({
	id,
	periodId,
	stackType,
	rate: 0.007
});

function input(over: Partial<PlannerInput>): PlannerInput {
	return {
		periods: PERIODS,
		targets: [],
		gemsByDay: flat(0),
		ticketPullsByDay: flat(0),
		stacks: { normal: 0, limited: 0 },
		currentMileage: 0,
		rule: RULE,
		mileage: MILEAGE,
		costPerPull: 120,
		...over
	};
}

describe('spendInPeriod — 기간 안 티켓 순서', () => {
	it('200연 = 청휘석 160연 + 마일리지 티켓 40연', () => {
		expect(spendInPeriod(200, 0, 0, MILEAGE)).toEqual({
			gemPulls: 160,
			ticketPulls: 0,
			mileagePulls: 40
		});
	});

	it('마일리지 티켓(기간제)을 가진 티켓보다 먼저 쓴다', () => {
		// 80연: 70에서 받은 티켓 10연을 먼저, 그 전 70연은 가진 티켓 20연 + 청휘석 50연
		expect(spendInPeriod(80, 20, 0, MILEAGE)).toEqual({
			gemPulls: 50,
			ticketPulls: 20,
			mileagePulls: 10
		});
	});
});

describe('planPickups — 한 목표', () => {
	it('19,200개면 확정, 천장 전 확률은 199연까지', () => {
		const r = planPickups(
			input({ targets: [target('a', 'p1', 'normal')], gemsByDay: flat(19200) })
		);
		expect(r.outcomes[0]).toMatchObject({ kind: 'secured', stackStart: 0, pullsToPity: 200 });
		const o = r.outcomes[0];
		if (o.kind === 'secured') expect(o.probabilityBeforePity).toBeCloseTo(0.875571, 6);
		expect(r.periods[0]).toMatchObject({
			periodId: 'p1',
			day: 6,
			pulls: 200,
			gemPulls: 160,
			mileagePulls: 40
		});
		expect(r.periods[0]).toMatchObject({ gemsBefore: 19200, gemsAfter: 0 });
	});

	it('모자라면 short — 모자란 청휘석을 알려준다', () => {
		const r = planPickups(
			input({ targets: [target('a', 'p1', 'normal')], gemsByDay: flat(15000) })
		);
		expect(r.outcomes[0]).toMatchObject({ kind: 'short', shortfallGems: 4200 });
		expect(r.securedCount).toBe(0);
		expect(r.periods).toEqual([]);
	});

	it('기간 마지막 날까지 받는 수급을 쓴다', () => {
		// 오늘 0개, 하루 3,000개씩 → 6일째 18,000 / 7일째 21,000
		const rising = Array.from({ length: 30 }, (_, d) => d * 3000);
		const early = planPickups(input({ targets: [target('a', 'p1', 'normal')], gemsByDay: rising }));
		const late = planPickups(input({ targets: [target('a', 'p2', 'normal')], gemsByDay: rising }));
		expect(early.outcomes[0].kind).toBe('short');
		expect(late.outcomes[0].kind).toBe('secured');
	});

	it('지출 뒤에 잔고가 줄어드는 날(AP 구매)도 지켜야 한다', () => {
		// 6일째 19,200이지만 10일째 18,000으로 내려간다 → 1,200 부족
		const dip = flat(19200).map((g, d) => (d >= 10 ? 18000 : g));
		const r = planPickups(input({ targets: [target('a', 'p1', 'normal')], gemsByDay: dip }));
		expect(r.outcomes[0]).toMatchObject({ kind: 'short', shortfallGems: 1200 });
	});

	it('남겨 둘 청휘석을 지킨다', () => {
		const r = planPickups(
			input({ targets: [target('a', 'p1', 'normal')], gemsByDay: flat(19200), reserveGems: 1000 })
		);
		expect(r.outcomes[0]).toMatchObject({ kind: 'short', shortfallGems: 1000 });
	});

	it('가진 티켓을 쓴다', () => {
		const r = planPickups(
			input({
				targets: [target('a', 'p1', 'normal')],
				gemsByDay: flat(18000),
				ticketPullsByDay: flat(10)
			})
		);
		expect(r.outcomes[0].kind).toBe('secured');
		expect(r.periods[0]).toMatchObject({ ticketPulls: 10, gemPulls: 150 });
	});

	it('끝난 기간·없는 기간은 unavailable', () => {
		const r = planPickups(
			input({
				periods: [{ id: 'old', startDay: -14, endDay: 0 }, ...PERIODS],
				targets: [target('a', 'old', 'normal'), target('b', 'nope', 'normal')],
				gemsByDay: flat(99999)
			})
		);
		expect(r.outcomes.map((o) => o.kind === 'unavailable' && o.reason)).toEqual([
			'period_ended',
			'unknown_period'
		]);
	});
});

describe('planPickups — 스택 이월', () => {
	it('종류의 첫 목표는 지금 스택에서, 그 뒤는 0에서', () => {
		const r = planPickups(
			input({
				targets: [target('a', 'p1', 'normal'), target('b', 'p2', 'normal')],
				stacks: { normal: 100, limited: 0 },
				gemsByDay: flat(99999)
			})
		);
		expect(r.outcomes.map((o) => o.kind !== 'unavailable' && o.stackStart)).toEqual([100, 0]);
		// 100연: 70에서 티켓 1장 → 청휘석 90연 = 10,800
		expect(r.periods[0].gemPulls * 120).toBe(10800);
		expect(r.periods[1].gemPulls * 120).toBe(19200);
	});

	it('스택 종류가 다르면 서로 돕지 못한다', () => {
		const r = planPickups(
			input({
				targets: [target('a', 'p1', 'normal'), target('b', 'p2', 'limited')],
				stacks: { normal: 150, limited: 0 },
				gemsByDay: flat(99999)
			})
		);
		expect(r.outcomes.map((o) => o.kind !== 'unavailable' && o.stackStart)).toEqual([150, 0]);
	});

	it('같은 기간 목표끼리 마일리지를 함께 쌓는다', () => {
		// 50연 + 50연 = 100연 → 70에서 티켓 1장
		const r = planPickups(
			input({
				targets: [target('a', 'p1', 'normal'), target('b', 'p1', 'limited')],
				stacks: { normal: 150, limited: 150 },
				gemsByDay: flat(10800)
			})
		);
		expect(r.securedCount).toBe(2);
		expect(r.periods[0]).toMatchObject({ pulls: 100, gemPulls: 90, mileagePulls: 10 });
	});
});

describe('planPickups — 우선순위와 대안', () => {
	// A(1순위, p2 모집 스택): B가 없으면 스택 150에서 6,000 / B가 있으면 0에서 19,200
	// B(2순위, p1 모집 스택 150) 6,000, C(3순위, p1 특별 스택 150) 6,000 — B+C는 같은 기간이라 10,800
	const abc = input({
		targets: [
			target('A', 'p2', 'normal'),
			target('B', 'p1', 'normal'),
			target('C', 'p1', 'limited')
		],
		stacks: { normal: 150, limited: 150 },
		gemsByDay: flat(11000)
	});

	it('1순위를 지킨다 — 뒤 순위가 1순위를 밀어내지 않는다', () => {
		const r = planPickups(abc);
		expect(r.outcomes.map((o) => o.kind)).toEqual(['secured', 'short', 'short']);
		// B를 더하면 A가 0에서 시작해 6,000 + 19,200 = 25,200
		expect(r.outcomes[1]).toMatchObject({ kind: 'short', shortfallGems: 14200 });
	});

	it('부족 청휘석은 앞 순위 계획만 두고 센다 — 계획에 든 뒤 순위 목표의 비용을 섞지 않는다', () => {
		// A(1순위, p1 모집 스택 0) 19,200 / B(2순위, p2 특별 스택 150) 6,000, 잔고 10,000
		// B만 확보된다. A의 부족은 A 혼자일 때의 9,200 — B까지 더한 15,200이 아니다
		const ab = input({
			targets: [target('A', 'p1', 'normal'), target('B', 'p2', 'limited')],
			stacks: { normal: 0, limited: 150 },
			gemsByDay: flat(10000)
		});
		const r = planPickups(ab);
		expect(r.outcomes.map((o) => o.kind)).toEqual(['short', 'secured']);
		expect(r.outcomes[0]).toMatchObject({ kind: 'short', shortfallGems: 9200, stackStart: 0 });
		// 모자란 만큼 더 받으면 A가 계획에 들고, B는 뒤 순위라 밀려난다
		const more = planPickups({ ...ab, gemsByDay: flat(10000 + 9200) });
		expect(more.outcomes.map((o) => o.kind)).toEqual(['secured', 'short']);
	});

	it('사용자 예시 — 2순위를 데려오려면 2순위 픽업까지 6,000개, 그러면 3순위가 밀려난다', () => {
		// 시작 36,000, 픽업 사이마다 +6,000, 천장 24,000 (마일리지 없음). 1·2·3순위가 날짜 순서대로
		const steps = (extra: number) =>
			Array.from(
				{ length: 30 },
				(_, d) => 36000 + (d >= 7 ? 6000 + extra : 0) + (d >= 14 ? 6000 : 0)
			);
		const example = (extra: number) =>
			planPickups(
				input({
					targets: [
						target('1', 'p1', 'normal'),
						target('2', 'p2', 'normal'),
						target('3', 'p3', 'normal')
					],
					gemsByDay: steps(extra),
					mileage: { ticketAt: [], pullsPerTicket: 10 }
				})
			);
		// 2순위 픽업 때 18,000개뿐 → 넘기기. 3순위는 24,000개로 확보
		const now = example(0);
		expect(now.outcomes.map((o) => o.kind)).toEqual(['secured', 'short', 'secured']);
		expect(now.outcomes[1]).toMatchObject({ shortfallGems: 6000 });
		// 2순위 픽업까지 6,000개를 더 받으면 2순위 확보, 3순위는 18,000개 부족
		const more = example(6000);
		expect(more.outcomes.map((o) => o.kind)).toEqual(['secured', 'secured', 'short']);
		expect(more.outcomes[2]).toMatchObject({ shortfallGems: 18000 });
	});

	it('대안 탐색을 끌 수 있다 (부족분 메우기가 다시 돌릴 때)', () => {
		const r = planPickups(abc, { alternatives: false });
		expect(r.alternatives).toEqual([]);
		expect(r.outcomes).toEqual(planPickups(abc).outcomes);
	});

	it('더 많이 확보하는 조합을 대안으로 보여준다', () => {
		const r = planPickups(abc);
		expect(r.alternatives[0]).toEqual({
			securedIds: ['B', 'C'],
			droppedIds: ['A'],
			gainedIds: ['B', 'C']
		});
	});

	it('계획·대안은 모두 실제로 가능한 조합이다 (무작위 검사)', () => {
		let seed = 7;
		const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
		for (let k = 0; k < 60; k++) {
			const targets = Array.from({ length: 1 + Math.floor(rand() * 5) }, (_, i) =>
				target(`t${i}`, `p${1 + Math.floor(rand() * 3)}`, rand() < 0.5 ? 'normal' : 'limited')
			);
			const base = input({
				targets,
				stacks: { normal: Math.floor(rand() * 200), limited: Math.floor(rand() * 200) },
				gemsByDay: Array.from({ length: 30 }, (_, d) => 5000 + d * Math.floor(rand() * 2000))
			});
			const r = planPickups(base);
			const secured = r.outcomes.filter((o) => o.kind === 'secured').map((o) => o.id);
			// 계획만 다시 넣으면 전부 확보된다
			const again = planPickups({
				...base,
				targets: targets.filter((t) => secured.includes(t.id))
			});
			expect(again.securedCount).toBe(secured.length);
			expect(Math.min(...r.balance)).toBeGreaterThanOrEqual(0);
			for (const alt of r.alternatives) {
				expect(alt.securedIds.length).toBeGreaterThan(r.securedCount);
				const only = planPickups({
					...base,
					targets: targets.filter((t) => alt.securedIds.includes(t.id))
				});
				expect(only.securedCount).toBe(alt.securedIds.length);
			}
		}
	});
});
