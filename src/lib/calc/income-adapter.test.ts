import { describe, expect, it } from 'vitest';
import { calculateIncome, presetIncluded, type IncomeInput } from './income-adapter';

const base: IncomeInput = {
	today: '2026-09-26',
	endDate: '2026-09-30',
	gems: 0,
	singleTickets: 0,
	tenPullTickets: 0,
	included: [],
	tacticalDaily: 20,
	raidTier: 'gold',
	participation: 'full',
	subscriptions: {},
	apPurchasesPerDay: 0
};
const run = (over: Partial<IncomeInput> = {}) => {
	const r = calculateIncome({ ...base, ...over });
	if (r.kind !== 'ok') throw new Error(`invalid: ${r.field}`);
	return r;
};
const amountOf = (r: ReturnType<typeof run>, id: string) =>
	r.sources.find((s) => s.id === id)?.amount ?? 0;

describe('고정 수급', () => {
	it('일일 임무 20 × 4일', () => {
		expect(run({ included: ['daily-mission'] }).income).toBe(80);
	});

	it('주간 임무는 7일에 정확히 120', () => {
		expect(run({ included: ['weekly-mission'], endDate: '2026-10-03' }).income).toBe(120);
	});

	it('전술대회는 입력한 일일 보상', () => {
		expect(run({ included: ['tactical-tournament'], tacticalDaily: 18 }).income).toBe(72);
	});
});

describe('일정표 수급 — 총력전 #86 (09-22 ~ 09-29)', () => {
	it('최종·누적 포인트 보상은 종료일(3일째)에', () => {
		const r = run({ included: ['raid-score', 'raid-rank'] });
		expect(r.records[3].income).toBe(650 + 1000);
		expect(r.income).toBe(1650);
	});

	it('등급을 바꾸면 최종 보상이 바뀐다', () => {
		expect(run({ included: ['raid-rank'], raidTier: 'platinum' }).income).toBe(1200);
	});

	it('일일 입장 보상은 시즌 기간 중 계산 기간에 들어온 날만 (09-27, 09-28)', () => {
		expect(run({ included: ['raid-daily-entry'] }).income).toBe(20);
	});

	it('대결전 #34(10-06 시작)는 기간 밖', () => {
		expect(run({ included: ['eliminate-raid-reward'] }).tickets).toBe(0);
	});

	it('대결전 #34 보상은 티켓 1장, 청휘석에 섞이지 않는다', () => {
		const r = run({
			included: ['eliminate-raid-reward', 'eliminate-raid-score'],
			endDate: '2026-10-14'
		});
		expect(r.tickets).toBe(1);
		expect(r.income).toBe(650);
		expect(r.sources.at(-1)).toMatchObject({ id: 'eliminate-raid-reward', unit: 'tenPullTicket' });
	});
});

describe('이벤트 — 백에서 피어난 한 송이 (09-29 ~ 10-13, 14일, 추정)', () => {
	it('기간에 고르게 나눠, 계산 기간에 들어온 이틀치만', () => {
		// 1,600 / 14일 → 첫날 114, 둘째 날 114
		const r = run({ included: ['event'] });
		expect(r.income).toBe(228);
		expect(r.estimated).toBe(true);
	});

	it('참여도 절반이면 이벤트 총량이 절반', () => {
		// 10-12까지 = 이 이벤트 14일 전부. 10-13은 다음 이벤트(람과천청) 첫날이라 뺀다
		const full = run({ included: ['event'], endDate: '2026-10-12' });
		const half = run({ included: ['event'], endDate: '2026-10-12', participation: 'half' });
		expect(full.income).toBe(1600);
		expect(half.income).toBe(800);
	});

	it('이벤트 목록이 끝난 뒤까지 계산하면 알려준다', () => {
		const r = run({ included: ['event'], endDate: '2027-03-01' });
		expect(r.eventsCoveredUntil).toBe('2027-01-26');
		expect(
			run({ included: ['daily-mission'], endDate: '2027-03-01' }).eventsCoveredUntil
		).toBeNull();
	});
});

describe('정액 상품', () => {
	it('월정액 1회: 즉시 392 + 30일 × 40', () => {
		const r = run({ subscriptions: { 'monthly-pass': 1 }, endDate: '2026-12-31' });
		expect(amountOf(r, 'monthly-pass')).toBe(392 + 30 * 40);
		expect(r.subscriptionPurchases).toEqual([{ id: 'monthly-pass', name: '월정액', purchases: 1 }]);
	});

	it('계속 구매면 기간에 필요한 만큼 산다', () => {
		const r = run({ subscriptions: { 'half-pass': 'continuous' }, endDate: '2026-12-25' });
		// 90일 → 3회
		expect(r.subscriptionPurchases[0].purchases).toBe(3);
		expect(amountOf(r, 'half-pass')).toBe(3 * 176 + 90 * 20);
	});
});

describe('AP 구매 (포지셔닝 ②)', () => {
	it('청휘석 소비를 차감하고 모집 연차로 환산', () => {
		const r = run({ included: ['daily-mission'], apPurchasesPerDay: 6, gems: 2000 });
		expect(r.spend).toBe(270 * 4);
		expect(r.net).toBe(80 - 1080);
		expect(r.endBalance).toBe(2000 - 1000);
		expect(r.spendPulls).toBe(9); // 1,080 / 120
	});

	it('잔고가 바닥나는 날', () => {
		const r = run({ apPurchasesPerDay: 20, gems: 5000 });
		// 하루 3,120 → 2일째에 음수
		expect(r.depletedOn).toBe('2026-09-28');
	});
});

describe('종합', () => {
	it('전체 임무 프리셋 90일: 수급원 합계 = 수입, 잔고 = 보유 + 순수입', () => {
		const r = run({
			included: presetIncluded('full'),
			endDate: '2026-12-25',
			gems: 3000,
			tenPullTickets: 1
		});
		const pyroxene = r.sources
			.filter((s) => s.unit === 'pyroxene')
			.reduce((a, s) => a + s.amount, 0);
		expect(pyroxene).toBe(r.income);
		expect(r.endBalance).toBe(3000 + r.net);
		expect(r.endPulls).toBe(Math.floor(r.endBalance / 120) + (1 + r.tickets) * 10);
		expect(r.records.at(-1)?.balance).toBe(r.endBalance);
	});

	it('입력 오류는 칸 이름으로', () => {
		expect(calculateIncome({ ...base, endDate: '2026-09-26' })).toEqual({
			kind: 'invalid',
			field: 'endDate'
		});
		expect(calculateIncome({ ...base, raidTier: 'diamond' })).toEqual({
			kind: 'invalid',
			field: 'raidTier'
		});
		expect(calculateIncome({ ...base, apPurchasesPerDay: 21 })).toEqual({
			kind: 'invalid',
			field: 'apPurchasesPerDay'
		});
		expect(calculateIncome({ ...base, subscriptions: { 'monthly-pass': -1 } })).toEqual({
			kind: 'invalid',
			field: 'subscriptions'
		});
	});
});
