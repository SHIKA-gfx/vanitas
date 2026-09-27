// 청휘석 수급 계산.
// 데이터 구조를 모르는 순수 함수만 둔다. 어떤 수급원이 어느 날 얼마를 주는지는 어댑터가 정한다.
//
// 레벨업 계산기와 같은 "하루 수급 함수 + 날짜별 누적" 구조다. 되먹임은 없지만,
// 날짜별 잔고 곡선을 그대로 플래너가 가져다 쓸 수 있게 하루 단위로 기록한다.

export type IncomeUnit = 'pyroxene' | 'tenPullTicket';

/** 수급원 하나. 어댑터가 데이터와 일정표로 만든다 */
export interface IncomeStream {
	id: string;
	unit: IncomeUnit;
	/** day일째(1부터) 받는 양. 청휘석이면 개수, 티켓이면 장수 */
	amountOn: (day: number) => number;
}

export interface IncomeDay {
	/** 0 = 계산 시점, 1부터 하루씩 */
	day: number;
	/** 그날 받은 청휘석 */
	income: number;
	/** 그날 쓴 청휘석 (AP 구매) */
	spend: number;
	/** 그날 받은 10회 모집 티켓 */
	tickets: number;
	/** 그날이 끝났을 때의 청휘석 잔고 */
	balance: number;
}

export interface IncomeSeries {
	records: IncomeDay[];
	/** 수급원별 합계 (단위는 수급원마다) */
	totals: Record<string, number>;
	income: number;
	spend: number;
	tickets: number;
	/** 잔고가 처음 0 아래로 내려간 날. 없으면 null */
	depletedDay: number | null;
}

export interface AccumulateParams {
	streams: IncomeStream[];
	days: number;
	/** 계산 시점의 청휘석 */
	startBalance: number;
	/** 하루에 쓰는 청휘석 (AP 구매) */
	dailySpend: number;
}

/** day 1부터 days까지 수급과 소비를 더해 날짜별 잔고를 만든다 */
export function accumulate(p: AccumulateParams): IncomeSeries {
	const totals: Record<string, number> = Object.fromEntries(p.streams.map((s) => [s.id, 0]));
	const records: IncomeDay[] = [
		{ day: 0, income: 0, spend: 0, tickets: 0, balance: p.startBalance }
	];
	let balance = p.startBalance;
	let income = 0;
	let tickets = 0;
	let depletedDay: number | null = null;

	for (let day = 1; day <= p.days; day++) {
		let dayIncome = 0;
		let dayTickets = 0;
		for (const s of p.streams) {
			const amount = s.amountOn(day);
			if (amount === 0) continue;
			totals[s.id] += amount;
			if (s.unit === 'tenPullTicket') dayTickets += amount;
			else dayIncome += amount;
		}
		balance += dayIncome - p.dailySpend;
		income += dayIncome;
		tickets += dayTickets;
		if (depletedDay === null && balance < 0) depletedDay = day;
		records.push({ day, income: dayIncome, spend: p.dailySpend, tickets: dayTickets, balance });
	}

	return { records, totals, income, spend: p.dailySpend * p.days, tickets, depletedDay };
}

// ---------------------------------------------------------------- 부품

/**
 * 정액 상품(월정액·반정액)을 day일째 받는 청휘석.
 * 내일(1일째)부터 산다고 보고, 구매마다 첫날 즉시 지급분 + 기간 동안 매일 지급분을 받는다.
 * purchases가 'continuous'면 끊기지 않고 계속 산다.
 */
export function subscriptionOn(
	day: number,
	product: { instant: number; daily: number; durationDays: number },
	purchases: number | 'continuous'
): number {
	const cycle = Math.floor((day - 1) / product.durationDays);
	if (purchases !== 'continuous' && cycle >= purchases) return 0;
	const firstDay = (day - 1) % product.durationDays === 0;
	return product.daily + (firstDay ? product.instant : 0);
}

/** days일 동안 실제로 사는 정액 상품 횟수 */
export function subscriptionPurchases(
	days: number,
	durationDays: number,
	purchases: number | 'continuous'
): number {
	const needed = Math.ceil(days / durationDays);
	return purchases === 'continuous' ? needed : Math.min(purchases, needed);
}

/**
 * 보유 재화를 모집 연차로 환산. 청휘석은 1회 비용으로 나눠 내림, 티켓은 장수 그대로.
 * 잔고가 음수면 청휘석 몫은 0으로 본다.
 */
export function toPulls(
	gems: number,
	tenPullTickets: number,
	singleTickets: number,
	costPerPull: number
): number {
	return Math.floor(Math.max(0, gems) / costPerPull) + tenPullTickets * 10 + singleTickets;
}
