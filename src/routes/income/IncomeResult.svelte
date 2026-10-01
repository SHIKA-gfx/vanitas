<!--
	결과 카드. outcome.kind로 문구를 고르고 숫자만 채운다.
	판정 규칙은 src/lib/calc/income-adapter.ts 에 있다 — 여기서 조건을 새로 만들지 않는다.
-->
<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import type { IncomeField, IncomeOutcome } from '$lib/calc/income-adapter';
	import { formatDate, formatInt } from '$lib/format';
	import Panel from '$lib/components/Panel.svelte';
	import Metric from '$lib/components/Metric.svelte';
	import Callout from '$lib/components/Callout.svelte';
	import Badge from '$lib/components/Badge.svelte';

	interface Props {
		result: IncomeOutcome;
		/** 보유 재화를 넣었으면 그날 예상 잔고를 보여준다 */
		hasHoldings: boolean;
	}

	let { result, hasHoldings }: Props = $props();

	function invalidMessage(field: IncomeField): string {
		return field === 'endDate' ? m.income_invalid_end_date() : m.income_invalid_other();
	}

	const signed = (n: number) => (n < 0 ? `-${formatInt(-n)}` : formatInt(n));
</script>

<Panel marks>
	{#if result.kind === 'invalid'}
		<p class="text-lg font-bold text-ink">{invalidMessage(result.field)}</p>
	{:else}
		<div class="flex flex-wrap items-start justify-between gap-2">
			<p class="text-[1.375rem] leading-snug font-bold text-ink">
				{#if result.net >= 0}
					{m.income_verdict_gain({
						date: formatDate(result.endDate),
						gems: formatInt(result.net)
					})}
				{:else}
					{m.income_verdict_loss({
						date: formatDate(result.endDate),
						gems: formatInt(-result.net)
					})}
				{/if}
			</p>
			{#if result.estimated}
				<Badge>{m.income_badge_estimated()}</Badge>
			{/if}
		</div>
		{#if hasHoldings}
			<!-- 잔고가 바닥나면 불가 색 (글자와 함께, 디자인 문서 2-4) -->
			<p
				class="mb-3 text-sm tabular-nums {result.endBalance < 0
					? 'font-bold text-blocked'
					: 'text-navy'}"
			>
				{m.income_verdict_balance({ gems: signed(result.endBalance) })}
			</p>
		{:else}
			<div class="mb-3"></div>
		{/if}

		<div class="grid grid-cols-3 gap-2">
			<Metric
				label={m.income_metric_per_day()}
				value={signed(Math.round(result.perDay))}
				tone={result.net < 0 ? 'shortfall' : 'neutral'}
			/>
			<Metric
				label={m.income_metric_per_week()}
				value={signed(Math.round(result.perWeek))}
				tone={result.net < 0 ? 'shortfall' : 'neutral'}
			/>
			<Metric
				label={m.income_metric_per_month()}
				value={signed(Math.round(result.perMonth))}
				tone={result.net < 0 ? 'shortfall' : 'neutral'}
			/>
		</div>

		<div class="mt-2 grid grid-cols-2 gap-2">
			<Metric
				label={m.income_metric_end_pulls()}
				value={m.unit_pulls({ count: formatInt(result.endPulls) })}
			/>
			{#if result.tickets > 0}
				<Metric
					label={m.income_metric_tickets()}
					value={m.unit_tickets({ count: formatInt(result.tickets) })}
				/>
			{/if}
			{#each result.subscriptionPurchases as p (p.id)}
				<Metric
					label={m.income_metric_subscription({ name: p.name })}
					value={m.unit_times({ count: formatInt(p.purchases) })}
				/>
			{/each}
		</div>

		<!-- 포지셔닝 ② 재화 간 교환: AP 구매가 픽업 몇 연분인지 -->
		{#if result.spend > 0}
			<div class="mt-3 flex flex-col gap-2">
				<Callout>
					{m.income_spend_note({
						gems: formatInt(result.spend),
						pulls: m.unit_pulls({ count: formatInt(result.spendPulls) })
					})}
					{#if result.depletedOn}
						{m.income_verdict_depleted({ date: formatDate(result.depletedOn) })}
					{/if}
				</Callout>
			</div>
		{/if}

		<div class="mt-3 flex flex-col gap-1 text-xs leading-relaxed text-navy">
			{#if result.eventsCoveredUntil}
				<p>{m.income_note_events_until({ date: formatDate(result.eventsCoveredUntil) })}</p>
			{/if}
			<p>{m.income_note_assumptions()}</p>
		</div>
	{/if}
</Panel>
