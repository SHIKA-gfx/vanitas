// 청휘석 수급 계산기 어댑터.
// data 계층의 수급원·일정표를 하루 단위 수급원(IncomeStream)으로 바꾸고, income.ts의 누적 결과를
// 화면용 결과로 바꾼다. 화면은 outcome.kind만 보고 문구를 고른다.
//
// 계산 시점 (기획서 3-1, 2026-09-26 확정)
// - 레이드 최종·누적 포인트 보상: 시즌 종료일
// - 레이드 일일 입장 보상: 시즌 기간 매일 (시작일 ~ 종료 전날)
// - 이벤트: 기간에 하루씩 고르게
// - 오늘 남은 수급은 세지 않는다. 1일째 = 내일

import {
	getApConfig,
	getGameConfig,
	getIncomeSources,
	listEvents,
	listRaidSeasons,
	type ServerId
} from '$lib/data';
import type { IncomeSource, ScheduleStream } from '$lib/data/types';
import { addDays, daysBetween, isDateString } from '$lib/game-date';
import { purchaseCostPerDay, spreadEvenly } from './levelup';
import {
	accumulate,
	subscriptionOn,
	subscriptionPurchases,
	toPulls,
	type IncomeDay,
	type IncomeStream,
	type IncomeUnit
} from './income';

/** 종료 날짜는 오늘로부터 이 일수 안이어야 한다 */
export const MAX_DAYS = 3650;

const PERIOD_DAYS = { daily: 1, weekly: 7, every10days: 10 } as const;

export interface IncomeInput {
	/** 계산 기준 게임 날짜. 1일째 = 내일 */
	today: string;
	/** 이 날까지 계산한다 */
	endDate: string;
	/** 보유 재화 (UserState) */
	gems: number;
	singleTickets: number;
	tenPullTickets: number;
	/** 포함할 무료 수급원 id (프리셋 + 체크 수정 결과) */
	included: string[];
	/** 전술대회 일일 보상 (순위마다 다르다) */
	tacticalDaily: number;
	/** 총력전 최종 보상 등급 id */
	raidTier: string;
	/** 이벤트 참여도 id */
	participation: string;
	/** 정액 상품 id → 구매 횟수 (0 = 안 삼) 또는 'continuous' */
	subscriptions: Record<string, number | 'continuous'>;
	/** 하루 청휘석 AP 구매 횟수 (UserState) */
	apPurchasesPerDay: number;
	server?: ServerId;
}

export type IncomeField =
	| 'endDate'
	| 'gems'
	| 'singleTickets'
	| 'tenPullTickets'
	| 'tacticalDaily'
	| 'raidTier'
	| 'participation'
	| 'subscriptions'
	| 'apPurchasesPerDay';

export interface SourceTotal {
	id: string;
	name: string;
	unit: IncomeUnit;
	amount: number;
	/** 추정 일정이나 미검증 수치가 섞여 있다 */
	estimated: boolean;
	paid: boolean;
}

export interface IncomeReport {
	kind: 'ok';
	days: number;
	endDate: string;
	/** 받는 청휘석 합계 */
	income: number;
	/** AP 구매에 쓰는 청휘석 합계 */
	spend: number;
	/** income - spend */
	net: number;
	/** 받는 10회 모집 티켓 */
	tickets: number;
	/** 종료일의 청휘석 잔고 (보유 청휘석 + net) */
	endBalance: number;
	/** 종료일에 가진 재화 전체를 모집 연차로 (보유 티켓 포함) */
	endPulls: number;
	/** AP 구매에 쓰는 청휘석을 모집 연차로 */
	spendPulls: number;
	/** 하루 / 주 / 월(30일) 평균 순수입 */
	perDay: number;
	perWeek: number;
	perMonth: number;
	/** 수급원별 합계. 청휘석 많은 순, 티켓은 뒤 */
	sources: SourceTotal[];
	/** 정액 상품을 실제로 사는 횟수 */
	subscriptionPurchases: { id: string; name: string; purchases: number }[];
	records: IncomeDay[];
	/** 잔고가 처음 0 아래로 내려가는 날. 없으면 null */
	depletedOn: string | null;
	/** 추정이 섞인 결과인가 */
	estimated: boolean;
	/** 이벤트 일정이 종료 날짜 전에 끝나면 그 날짜 (그 뒤 이벤트 수급은 빠져 있다) */
	eventsCoveredUntil: string | null;
}

export type IncomeOutcome = { kind: 'invalid'; field: IncomeField } | IncomeReport;

// ---------------------------------------------------------------- 검사

function isIntIn(value: number, min: number, max: number): boolean {
	return Number.isInteger(value) && value >= min && value <= max;
}

function checkInput(input: IncomeInput, server: ServerId): IncomeField | null {
	const data = getIncomeSources(server);
	const ap = getApConfig(server);
	if (!isDateString(input.endDate)) return 'endDate';
	const days = daysBetween(input.today, input.endDate);
	if (days < 1 || days > MAX_DAYS) return 'endDate';
	for (const key of ['gems', 'singleTickets', 'tenPullTickets'] as const) {
		if (!isIntIn(input[key], 0, Number.MAX_SAFE_INTEGER)) return key;
	}
	if (!isIntIn(input.tacticalDaily, 0, Number.MAX_SAFE_INTEGER)) return 'tacticalDaily';
	const rank = data.sources.find((s) => s.tiers);
	if (rank && !rank.tiers?.some((t) => t.id === input.raidTier)) return 'raidTier';
	if (!data.eventParticipation.some((p) => p.id === input.participation)) return 'participation';
	for (const [id, n] of Object.entries(input.subscriptions)) {
		if (!data.subscriptions.some((s) => s.id === id)) return 'subscriptions';
		if (n !== 'continuous' && !isIntIn(n, 0, Number.MAX_SAFE_INTEGER)) return 'subscriptions';
	}
	if (!isIntIn(input.apPurchasesPerDay, 0, ap.purchase.maxPurchasesPerDay)) {
		return 'apPurchasesPerDay';
	}
	return null;
}

// ---------------------------------------------------------------- 수급원 만들기

/** 날짜별 금액을 모아 두는 표. 같은 날 여러 번 더해질 수 있다 */
class DayTable {
	private map = new Map<number, number>();
	estimated = false;
	constructor(
		private today: string,
		private days: number
	) {}
	/** 날짜가 계산 기간(1일째~마지막 날) 안이면 더한다. 더했으면 true */
	add(date: string, amount: number): boolean {
		const day = daysBetween(this.today, date);
		if (day < 1 || day > this.days || amount === 0) return false;
		this.map.set(day, (this.map.get(day) ?? 0) + amount);
		return true;
	}
	on = (day: number) => this.map.get(day) ?? 0;
}

/** 레이드·이벤트처럼 일정표를 따르는 수급원 */
function scheduledTable(
	source: IncomeSource,
	amount: number,
	input: IncomeInput,
	days: number,
	server: ServerId
): DayTable {
	const table = new DayTable(input.today, days);
	const stream = source.schedule as ScheduleStream;

	if (stream === 'event') {
		for (const e of listEvents(server)) {
			const length = daysBetween(e.start, e.end);
			for (let k = 1; k <= length; k++) {
				const added = table.add(addDays(e.start, k - 1), spreadEvenly(amount, length, k));
				if (added && e.status === 'estimated') table.estimated = true;
			}
		}
		return table;
	}

	for (const season of listRaidSeasons(stream, input.endDate, server)) {
		let added = false;
		if (source.period === 'perSeason') {
			added = table.add(season.end, amount);
		} else {
			const length = daysBetween(season.start, season.end);
			for (let k = 0; k < length; k++) {
				added = table.add(addDays(season.start, k), amount) || added;
			}
		}
		if (added && season.status === 'estimated') table.estimated = true;
	}
	return table;
}

interface BuiltStream extends IncomeStream {
	name: string;
	estimated: boolean;
	paid: boolean;
}

function buildStreams(input: IncomeInput, days: number, server: ServerId): BuiltStream[] {
	const data = getIncomeSources(server);
	const factor = data.eventParticipation.find((p) => p.id === input.participation)?.factor ?? 0;
	const streams: BuiltStream[] = [];

	for (const source of data.sources) {
		if (!input.included.includes(source.id) || source.period === 'irregular') continue;

		let amount = source.amount ?? 0;
		if (source.id === 'tactical-tournament') amount = input.tacticalDaily;
		if (source.tiers) amount = source.tiers.find((t) => t.id === input.raidTier)?.amount ?? 0;
		if (source.period === 'perEvent') amount = Math.round(amount * factor);

		const base = {
			id: source.id,
			name: source.name,
			unit: source.unit ?? 'pyroxene',
			paid: false
		} as const;

		if (
			source.period === 'daily' ||
			source.period === 'weekly' ||
			source.period === 'every10days'
		) {
			const period = PERIOD_DAYS[source.period];
			streams.push({
				...base,
				estimated: !source.verified,
				amountOn: (day) => spreadEvenly(amount, period, day)
			});
		} else {
			const table = scheduledTable(source, amount, input, days, server);
			streams.push({ ...base, estimated: !source.verified || table.estimated, amountOn: table.on });
		}
	}

	for (const product of data.subscriptions) {
		const purchases = input.subscriptions[product.id] ?? 0;
		if (purchases === 0) continue;
		streams.push({
			id: product.id,
			name: product.name,
			unit: 'pyroxene',
			paid: true,
			estimated: !product.verified,
			amountOn: (day) => subscriptionOn(day, product, purchases)
		});
	}
	return streams;
}

// ---------------------------------------------------------------- 진입점

export function calculateIncome(input: IncomeInput): IncomeOutcome {
	const server = input.server ?? 'ko';
	const bad = checkInput(input, server);
	if (bad) return { kind: 'invalid', field: bad };

	const data = getIncomeSources(server);
	const costPerPull = getGameConfig(server).recruitCost.single;
	const days = daysBetween(input.today, input.endDate);
	const streams = buildStreams(input, days, server);
	const dailySpend =
		purchaseCostPerDay(input.apPurchasesPerDay, getApConfig(server).purchase.priceTiers) ?? 0;

	const series = accumulate({ streams, days, startBalance: input.gems, dailySpend });
	const net = series.income - series.spend;
	const endBalance = input.gems + net;

	const sources: SourceTotal[] = streams
		.map((s) => ({
			id: s.id,
			name: s.name,
			unit: s.unit,
			amount: series.totals[s.id],
			estimated: s.estimated,
			paid: s.paid
		}))
		.filter((s) => s.amount > 0)
		.sort((a, b) => (a.unit === b.unit ? b.amount - a.amount : a.unit === 'pyroxene' ? -1 : 1));

	const events = listEvents(server);
	const lastEventEnd = events.length ? events[events.length - 1].end : null;
	const eventIncluded = input.included.includes('event');

	return {
		kind: 'ok',
		days,
		endDate: input.endDate,
		income: series.income,
		spend: series.spend,
		net,
		tickets: series.tickets,
		endBalance,
		endPulls: toPulls(
			endBalance,
			input.tenPullTickets + series.tickets,
			input.singleTickets,
			costPerPull
		),
		spendPulls: Math.floor(series.spend / costPerPull),
		perDay: net / days,
		perWeek: (net / days) * 7,
		perMonth: (net / days) * 30,
		sources,
		subscriptionPurchases: data.subscriptions
			.filter((p) => (input.subscriptions[p.id] ?? 0) !== 0)
			.map((p) => ({
				id: p.id,
				name: p.name,
				purchases: subscriptionPurchases(days, p.durationDays, input.subscriptions[p.id])
			})),
		records: series.records,
		depletedOn: series.depletedDay === null ? null : addDays(input.today, series.depletedDay),
		estimated: streams.some((s) => s.estimated && series.totals[s.id] > 0),
		eventsCoveredUntil:
			eventIncluded && lastEventEnd && lastEventEnd < input.endDate ? lastEventEnd : null
	};
}

// ---------------------------------------------------------------- 화면 보조

/** 프리셋이 포함하는 무료 수급원 */
export function presetIncluded(presetId: string, server: ServerId = 'ko'): string[] {
	const preset = getIncomeSources(server).presets[presetId];
	return typeof preset === 'object' ? [...preset.include] : [];
}

/** 체크로 켜고 끌 수 있는 무료 수급원 (정기점검처럼 계산하지 않는 것은 뺀다) */
export function listToggleableSources(server: ServerId = 'ko'): IncomeSource[] {
	return getIncomeSources(server).sources.filter((s) => s.period !== 'irregular');
}
