import { describe, expect, it } from 'vitest';
import { accumulate, subscriptionOn, subscriptionPurchases, toPulls } from './income';

describe('accumulate', () => {
	it('수급과 소비를 날마다 더해 잔고를 만든다', () => {
		const r = accumulate({
			streams: [
				{ id: 'a', unit: 'pyroxene', amountOn: () => 20 },
				{ id: 't', unit: 'tenPullTicket', amountOn: (d) => (d === 2 ? 1 : 0) }
			],
			days: 3,
			startBalance: 100,
			dailySpend: 5
		});
		expect(r.records.map((x) => x.balance)).toEqual([100, 115, 130, 145]);
		expect(r).toMatchObject({ income: 60, spend: 15, tickets: 1, depletedDay: null });
		expect(r.totals).toEqual({ a: 60, t: 1 });
	});

	it('잔고가 처음 0 아래로 내려간 날을 알려준다', () => {
		const r = accumulate({
			streams: [{ id: 'a', unit: 'pyroxene', amountOn: () => 20 }],
			days: 10,
			startBalance: 50,
			dailySpend: 90
		});
		// 50 → -20 (1일째)
		expect(r.depletedDay).toBe(1);
	});
});

describe('정액 상품', () => {
	const pass = { instant: 392, daily: 40, durationDays: 30 };

	it('첫날 즉시 지급 + 매일 지급, 다음 구매 첫날 다시 즉시 지급', () => {
		expect(subscriptionOn(1, pass, 1)).toBe(432);
		expect(subscriptionOn(2, pass, 1)).toBe(40);
		expect(subscriptionOn(30, pass, 1)).toBe(40);
		expect(subscriptionOn(31, pass, 1)).toBe(0); // 1회만 샀다
		expect(subscriptionOn(31, pass, 2)).toBe(432);
		expect(subscriptionOn(91, pass, 'continuous')).toBe(432);
	});

	it('실제 구매 횟수는 기간에 필요한 만큼', () => {
		expect(subscriptionPurchases(45, 30, 'continuous')).toBe(2);
		expect(subscriptionPurchases(45, 30, 6)).toBe(2);
		expect(subscriptionPurchases(90, 30, 1)).toBe(1);
	});
});

describe('toPulls', () => {
	it('청휘석은 120개당 1연, 티켓은 장수대로', () => {
		expect(toPulls(24000, 1, 3, 120)).toBe(200 + 10 + 3);
		expect(toPulls(119, 0, 0, 120)).toBe(0);
	});
	it('잔고가 음수면 청휘석 몫은 0', () => {
		expect(toPulls(-500, 1, 0, 120)).toBe(10);
	});
});
