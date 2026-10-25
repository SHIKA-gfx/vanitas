/**
 * 픽업 플래너 — 부족분 메우기 (docs/005 9장).
 *
 * 질문: "부족"인 목표를 그 기간까지 데려오려면 수급 조건을 어떻게 바꾸면 되나.
 *
 * 결정 (2026-10-25)
 * - 바꾸는 폭: 켜고 끄는 항목(받는 보상)은 켜기, 실력이 필요한 항목(총력전 등급, 전술대회 순위)과 이벤트 참여도는 한 단계 위,
 *   AP 구매는 하루 N회 → 0회. 전술대회는 입력이 일일 보상 금액이라, 순위별 보상표(rankRewards)에서 그보다 많은 첫 금액으로 올린다
 * - 과금은 수급 계산기에 있는 정액 상품만. 청휘석 직접 구매는 다루지 않는다 (가격·수량 데이터 없음)
 * - 권하지 않는다: 무료 방법을 다 본 뒤에만 과금을 더한다. 화면은 사실(+N개)만 말한다
 *
 * 계산
 * - 조건 하나를 바꿔 **플래너 전체를 다시 돌린다** (수급 차이를 더하지 않는다) — 우선순위·스택 이월·다른 목표와의 관계가 그대로 반영된다
 * - 매 단계, 남은 방법 중 효과가 가장 큰 것을 하나 골라 누적한다. 효과 = 이 목표의 픽업에 더 쓸 수 있게 되는 청휘석
 *   (뽑는 날 이후 가장 낮은 잔고의 증가 — planner.ts가 비교하는 값 — + 그날까지 받는 10회 모집 티켓을 청휘석으로 환산).
 *   효과가 0인 방법은 고르지 않는다
 * - 그 목표가 확보되면 멈춘다. 무료를 다 써도 모자라면 과금을 같은 방식으로 더하고, 그래도 모자라면 남은 부족분을 알린다
 * - 우선순위는 그대로 둔다: 이 목표가 확보되며 뒤 순위 목표가 밀려나면 그 목표와 새 부족분을 함께 알린다 (사용자 예시, docs/005 9장)
 * - 정액 상품은 그 픽업이 끝날 때까지 필요한 구매 횟수까지만 늘린다. 확보되는 단계라면 확보되는 가장 적은 횟수로 줄인다
 * - 다시 돌릴 때는 대안 전수 탐색을 끄고(`alternatives: false`), 같은 수급 조건의 수급 계산은 한 번만 한다
 */

import { getGameConfig, getIncomeSources, listRecruits, type ServerId } from '$lib/data';
import { daysBetween } from '$lib/game-date';
import { listToggleableSources, type IncomeOutcome } from './income-adapter';
import {
	planFromData,
	plannerIncome,
	TEN_PULL_TICKET_PULLS,
	type PlannerIncomeInput,
	type PlannerOutcome,
	type PlannerQuery
} from './planner-adapter';
import type { TargetOutcome } from './planner';

/** 바꾸는 수급 조건 하나. 화면이 문구를 고를 수 있게 이름·라벨을 함께 싣는다 */
export type FillLever =
	/** 받지 않던 무료 보상 켜기. 이벤트면 그때의 참여도 라벨 */
	| { kind: 'source'; id: string; name: string; participation?: string }
	/** 총력전 최종 등급 한 단계 위 */
	| { kind: 'raidTier'; from: string; to: string }
	/** 전술대회 일일 보상 한 단계 위 (rank: 그 금액의 순위 라벨) */
	| { kind: 'tacticalRank'; from: number; to: number; rank: string }
	/** 이벤트 참여도 한 단계 위 */
	| { kind: 'participation'; from: string; to: string }
	/** 하루 AP 구매 N회 → 0회 */
	| { kind: 'apPurchases'; from: number }
	/** 정액 상품 구매 횟수 늘리기 (0 = 구매 안 함) */
	| { kind: 'subscription'; id: string; name: string; from: number; to: number };

export interface FillStep {
	lever: FillLever;
	kind: 'free' | 'paid';
	/** 이 목표의 픽업에 더 쓸 수 있게 되는 청휘석 (뽑는 날 이후 가장 낮은 잔고의 증가) */
	gainGems: number;
	/** 그 픽업까지 더 받는 10회 모집 티켓 (장) */
	gainTickets: number;
	/** 여기까지 바꿨을 때 이 목표의 부족 청휘석 (0 = 확보) */
	remainingAfter: number;
	/** 이 단계에서 새로 확보되는 다른 목표 (query.targets 번호, 0 = 1순위) */
	alsoSecured: number[];
	/** 이 단계에서 대신 확보하지 못하게 되는 다른 목표와 그 부족 청휘석 — 이 목표가 먼저 확보되며 밀려난다 */
	alsoLost: { index: number; shortfallGems: number }[];
}

export interface ShortfallFill {
	steps: FillStep[];
	/** 확보되는 단계 (steps 번호). 다 바꿔도 모자라면 null */
	securedAt: number | null;
	/** 다 바꾼 뒤에도 남는 부족 청휘석 (확보되면 0) */
	remaining: number;
}

type Ok = Extract<PlannerOutcome, { kind: 'ok' }>;

interface Candidate {
	lever: FillLever;
	/** 같은 조건을 두 번 바꾸지 않게 하는 이름 */
	keys: string[];
	next: PlannerIncomeInput;
}

/** 지금 조건에서 한 번에 바꿔 볼 수 있는 무료 방법 (데이터 순서) */
function freeCandidates(
	income: PlannerIncomeInput,
	used: Set<string>,
	server: ServerId
): Candidate[] {
	const data = getIncomeSources(server);
	const out: Candidate[] = [];
	const levels = [...data.eventParticipation].sort((a, b) => a.factor - b.factor);
	const at = levels.findIndex((p) => p.id === income.participation);
	const current = levels[at];
	const up = at >= 0 ? levels[at + 1] : undefined;

	// 받지 않던 무료 보상 켜기
	for (const s of listToggleableSources(server)) {
		const key = `source:${s.id}`;
		if (income.included.includes(s.id) || used.has(key)) continue;
		const next = { ...income, included: [...income.included, s.id] };
		if (s.period === 'perEvent' && current?.factor === 0 && up && !used.has('participation')) {
			// 참여도가 "미참여"면 켜도 받는 것이 없다 → 참여도도 한 단계 올려 하나의 방법으로 본다
			out.push({
				lever: { kind: 'source', id: s.id, name: s.name, participation: up.label },
				keys: [key, 'participation'],
				next: { ...next, participation: up.id }
			});
			continue;
		}
		out.push({
			lever: {
				kind: 'source',
				id: s.id,
				name: s.name,
				participation: s.period === 'perEvent' ? current?.label : undefined
			},
			keys: [key],
			next
		});
	}

	// 총력전 최종 등급 한 단계 위 (보상을 받지 않으면 효과가 0이라 저절로 빠진다)
	const rank = data.sources.find((s) => s.tiers);
	if (rank?.tiers && !used.has('raidTier')) {
		const tiers = [...rank.tiers].sort((a, b) => a.amount - b.amount);
		const i = tiers.findIndex((t) => t.id === income.raidTier);
		const higher = i >= 0 ? tiers[i + 1] : undefined;
		if (higher) {
			out.push({
				lever: { kind: 'raidTier', from: tiers[i].label, to: higher.label },
				keys: ['raidTier'],
				next: { ...income, raidTier: higher.id }
			});
		}
	}

	// 전술대회 순위 한 단계 위 — 지금 일일 보상보다 많은 첫 금액 (받지 않으면 효과가 0이라 저절로 빠진다)
	const tactical = data.sources.find((s) => s.rankRewards);
	if (tactical?.rankRewards && !used.has('tactical')) {
		const higher = [...tactical.rankRewards]
			.sort((a, b) => a.amount - b.amount)
			.find((r) => r.amount > income.tacticalDaily);
		if (higher) {
			out.push({
				lever: {
					kind: 'tacticalRank',
					from: income.tacticalDaily,
					to: higher.amount,
					rank: higher.label
				},
				keys: ['tactical'],
				next: { ...income, tacticalDaily: higher.amount }
			});
		}
	}

	// 이벤트 참여도 한 단계 위
	if (current && up && !used.has('participation')) {
		out.push({
			lever: { kind: 'participation', from: current.label, to: up.label },
			keys: ['participation'],
			next: { ...income, participation: up.id }
		});
	}

	// AP 구매 줄이기 — 하루 N회 → 0회
	if (income.apPurchasesPerDay > 0 && !used.has('ap')) {
		out.push({
			lever: { kind: 'apPurchases', from: income.apPurchasesPerDay },
			keys: ['ap'],
			next: { ...income, apPurchasesPerDay: 0 }
		});
	}
	return out;
}

/** 정액 상품을 count회 사는 조건 */
function withSubscription(income: PlannerIncomeInput, id: string, count: number) {
	return { ...income, subscriptions: { ...income.subscriptions, [id]: count } };
}

/**
 * 과금 방법: 수급 계산기에 있는 정액 상품을 그 픽업이 끝날 때까지 (내일부터 사면 day일째까지 받도록) 산다.
 * 이미 그만큼 사거나 "계속 구매"면 빠진다
 */
function paidCandidates(
	income: PlannerIncomeInput,
	used: Set<string>,
	day: number,
	server: ServerId
): Candidate[] {
	if (day < 1) return [];
	return getIncomeSources(server).subscriptions.flatMap((p) => {
		const now = income.subscriptions[p.id] ?? 0;
		const key = `subscription:${p.id}`;
		const needed = Math.ceil(day / p.durationDays);
		if (now === 'continuous' || now >= needed || used.has(key)) return [];
		return [
			{
				lever: { kind: 'subscription', id: p.id, name: p.name, from: now, to: needed },
				keys: [key],
				next: withSubscription(income, p.id, needed)
			} satisfies Candidate
		];
	});
}

/** 부족 청휘석 (확보면 0, 불가면 null) */
function shortOf(o: TargetOutcome | undefined): number | null {
	if (!o) return null;
	if (o.kind === 'secured') return 0;
	if (o.kind === 'short') return o.shortfallGems;
	return null;
}

/**
 * 한 query의 부족 목표들을 메우는 계산기. 수급 계산 결과를 목표끼리 나눠 쓴다 —
 * 화면이 접기를 여러 개 열어도 같은 수급 조건은 한 번만 계산한다.
 * 반환 함수의 targetIndex는 query.targets의 번호 (= 우선순위 - 1). 목표가 부족이 아니면(확보·불가) null
 */
export function createShortfallFiller(
	query: PlannerQuery
): (targetIndex: number) => ShortfallFill | null {
	const server = query.server ?? 'ko';
	const costPerPull = getGameConfig(server).recruitCost.single;
	const incomes = new Map<string, IncomeOutcome | null>();

	const incomeOf = (income: PlannerIncomeInput) => {
		const key = JSON.stringify(income);
		if (!incomes.has(key)) incomes.set(key, plannerIncome({ ...query, income }));
		return incomes.get(key) ?? null;
	};
	const plan = (income: PlannerIncomeInput) =>
		planFromData(
			{ ...query, income },
			{ alternatives: false, income: incomeOf(income) ?? undefined }
		);

	let base: PlannerOutcome | undefined;

	return (targetIndex) => {
		base ??= plan(query.income);
		if (base.kind !== 'ok') return null;
		const baseTarget = base.result.outcomes[targetIndex];
		if (baseTarget?.kind !== 'short') return null;

		// 이 목표를 뽑는 날 (planner.ts의 spendDay와 같다: 기간 마지막 날)
		const recruit = listRecruits({ server }).find((r) => r.id === baseTarget.periodId);
		if (!recruit) return null;
		const lastDay = base.result.balance.length - 1;
		const day = Math.min(Math.max(0, daysBetween(query.today, recruit.end) - 1), lastDay);

		/** 이 목표의 픽업에 쓸 수 있는 몫: 뽑는 날 이후 가장 낮은 잔고, 그날까지 받는 티켓 */
		const room = (income: PlannerIncomeInput) => {
			const r = incomeOf(income);
			if (!r || r.kind !== 'ok') return null;
			let gems = Infinity;
			for (const x of r.records.slice(day)) gems = Math.min(gems, x.balance);
			let tickets = 0;
			for (const x of r.records.slice(0, day + 1)) tickets += x.tickets;
			return { gems, tickets };
		};
		const worth = (g: { gems: number; tickets: number }) =>
			g.gems + g.tickets * TEN_PULL_TICKET_PULLS * costPerPull;

		let income = query.income;
		let current: Ok = base;
		const used = new Set<string>();
		const steps: FillStep[] = [];

		const record = (c: Candidate, kind: FillStep['kind'], next: Ok) => {
			const before = room(income)!;
			const after = room(c.next)!;
			const prev = current.result.outcomes;
			const now = next.result.outcomes;
			steps.push({
				lever: c.lever,
				kind,
				gainGems: after.gems - before.gems,
				gainTickets: after.tickets - before.tickets,
				remainingAfter: shortOf(now[targetIndex]) ?? 0,
				alsoSecured: now.flatMap((o, i) =>
					i !== targetIndex && o.kind === 'secured' && prev[i]?.kind === 'short' ? [i] : []
				),
				alsoLost: now.flatMap((o, i) =>
					i !== targetIndex && o.kind === 'short' && prev[i]?.kind === 'secured'
						? [{ index: i, shortfallGems: o.shortfallGems }]
						: []
				)
			});
			income = c.next;
			current = next;
			for (const k of c.keys) used.add(k);
		};

		for (const kind of ['free', 'paid'] as const) {
			for (;;) {
				const now = room(income);
				if (!now) break;
				const candidates =
					kind === 'free'
						? freeCandidates(income, used, server)
						: paidCandidates(income, used, day, server);
				let best: { c: Candidate; gain: number } | null = null;
				for (const c of candidates) {
					const r = room(c.next);
					const gain = r ? worth(r) - worth(now) : 0;
					if (gain > 0 && (!best || gain > best.gain)) best = { c, gain };
				}
				if (!best) break;

				let chosen = best.c;
				let next = plan(chosen.next);
				if (next.kind !== 'ok') break;

				// 정액 상품으로 확보되면, 확보되는 가장 적은 구매 횟수로 줄인다
				const lever = chosen.lever;
				if (lever.kind === 'subscription' && shortOf(next.result.outcomes[targetIndex]) === 0) {
					for (let count = lever.from + 1; count < lever.to; count++) {
						const fewer = withSubscription(income, lever.id, count);
						const tried = plan(fewer);
						if (tried.kind === 'ok' && shortOf(tried.result.outcomes[targetIndex]) === 0) {
							chosen = { ...chosen, lever: { ...lever, to: count }, next: fewer };
							next = tried;
							break;
						}
					}
				}

				record(chosen, kind, next);
				if (steps[steps.length - 1].remainingAfter === 0) {
					return { steps, securedAt: steps.length - 1, remaining: 0 };
				}
			}
		}

		return {
			steps,
			securedAt: null,
			remaining: shortOf(current.result.outcomes[targetIndex]) ?? 0
		};
	};
}

/** 목표 하나만 볼 때 (createShortfallFiller의 한 번 쓰기) */
export function fillShortfall(query: PlannerQuery, targetIndex: number): ShortfallFill | null {
	return createShortfallFiller(query)(targetIndex);
}
