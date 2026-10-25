<!--
	기간별 계획 — 목표가 있는 기간마다 한 줄: 날짜(추정), 행동(N연 / 넘기기), 그 시점 잔고 (docs/005 6장).
	가로 차트가 아니라 목록이다 — 380px에 몇 달치 주간 픽업이 들어가지 않는다

	판정 색 (2026-10-25, 디자인 문서 5-20): 줄마다 그 기간 목표의 판정을 바탕과 배지로 보여준다 (5-18과 같은 약속).
	- 그 기간 목표가 모두 확보 → 옅은 파랑 + "확보"
	- 하나라도 확보하지 못함(넘기기 포함) → 옅은 주황 + "부족"
	색만으로 말하지 않도록 배지가 늘 함께 있다 (2-4). 바탕 농도는 결과판과 같은 대비 한계 안 (파랑 8%·주황 12%)
-->
<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { formatDate, formatInt } from '$lib/format';
	import Badge from '$lib/components/Badge.svelte';
	import type { PlannerChoicePeriod, PlannerOutcome } from '$lib/calc/planner-adapter';

	interface Props {
		outcome: Extract<PlannerOutcome, { kind: 'ok' }>;
		periods: PlannerChoicePeriod[];
	}

	let { outcome, periods }: Props = $props();

	const nameOf = (periodId: string, studentId: string) =>
		periods.find((p) => p.recruit.id === periodId)?.choices.find((c) => c.studentId === studentId)
			?.student.name.ko ?? studentId;

	// 목표가 하나라도 있는 기간만, 날짜 순
	const rows = $derived(
		outcome.recruits
			.map((recruit) => {
				const targets = outcome.result.outcomes.filter((o) => o.periodId === recruit.id);
				return {
					recruit,
					spend: outcome.result.periods.find((p) => p.periodId === recruit.id),
					targets,
					secured: targets.length > 0 && targets.every((o) => o.kind === 'secured')
				};
			})
			.filter((r) => r.targets.length > 0)
	);
</script>

<ol class="flex flex-col gap-2 font-num">
	{#each rows as { recruit, spend, targets, secured } (recruit.id)}
		<li
			class="flex flex-col gap-1 rounded-lg px-3 py-3 {secured
				? 'bg-secured/8'
				: 'bg-shortfall/12'}"
		>
			<div class="flex flex-wrap items-center gap-2 text-sm">
				<span class="text-ink">{formatDate(recruit.start)}</span>
				{#if recruit.status === 'estimated'}<Badge>{m.planner_estimated()}</Badge>{/if}
				<span class="text-navy">{targets.map((t) => nameOf(recruit.id, t.id)).join(', ')}</span>
			</div>
			{#if spend}
				<p class="flex flex-wrap items-center gap-2 font-bold text-ink">
					{#if secured}
						<Badge tone="secured">{m.planner_badge_secured()}</Badge>
					{:else}
						<Badge tone="shortfall">{m.planner_badge_short()}</Badge>
					{/if}
					{m.planner_period_pull({
						pulls: formatInt(spend.pulls),
						gems: formatInt(spend.gemsBefore - spend.gemsAfter)
					})}
				</p>
				{#if spend.ticketPulls > 0 || spend.mileagePulls > 0}
					<p class="text-xs text-navy">
						{[
							spend.ticketPulls > 0
								? m.planner_period_owned_tickets({ pulls: formatInt(spend.ticketPulls) })
								: '',
							spend.mileagePulls > 0
								? m.planner_period_mileage_tickets({ pulls: formatInt(spend.mileagePulls) })
								: ''
						]
							.filter(Boolean)
							.join(' · ')}
					</p>
				{/if}
				<p class="text-sm text-navy">
					{m.planner_period_balance({
						before: formatInt(spend.gemsBefore),
						after: formatInt(spend.gemsAfter)
					})}
				</p>
			{:else}
				<p class="flex flex-wrap items-center gap-2 font-bold text-ink">
					<Badge tone="shortfall">{m.planner_badge_short()}</Badge>
					{m.planner_period_skip()}
				</p>
			{/if}
		</li>
	{/each}
</ol>
