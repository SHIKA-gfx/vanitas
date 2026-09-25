<!--
	결과 카드. outcome.kind로 문구를 고르고 숫자만 채운다.
	판정 규칙은 src/lib/calc/levelup.ts / levelup-adapter.ts 에 있다 — 여기서 조건을 새로 만들지 않는다.
-->
<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import {
		HORIZON_DAYS,
		summarizeRecords,
		type LevelUpCost,
		type LevelUpField,
		type LevelUpOutcome
	} from '$lib/calc/levelup-adapter';
	import { getApConfig } from '$lib/data';
	import { formatDate, formatInt } from '$lib/format';
	import Panel from '$lib/components/Panel.svelte';
	import Metric from '$lib/components/Metric.svelte';

	interface Props {
		result: LevelUpOutcome;
		/** 목표 레벨 모드의 목표. already 문구에 쓴다 */
		target: number;
	}

	let { result, target }: Props = $props();

	const packageName =
		getApConfig().fixedIncome.find((i) => i.durationDays !== undefined)?.name ?? '';

	function invalidMessage(field: LevelUpField): string {
		if (field === 'exp') return m.levelup_invalid_exp();
		if (field === 'goal') return m.levelup_invalid_goal_date();
		return m.levelup_invalid_other();
	}

	const summary = $derived(
		result.kind === 'reached' || result.kind === 'projected'
			? summarizeRecords(result.records)
			: null
	);
</script>

{#snippet metrics(cost: LevelUpCost)}
	<div class="grid grid-cols-2 gap-2">
		{#if summary?.avgDailyAp != null}
			<Metric label={m.levelup_metric_avg_ap()} value={formatInt(summary.avgDailyAp)} />
		{/if}
		{#if summary && summary.bonusAp > 0}
			<Metric label={m.levelup_metric_bonus_ap()} value={formatInt(summary.bonusAp)} />
		{/if}
		{#if cost.pyroxene > 0}
			<Metric label={m.levelup_metric_gems()} value={formatInt(cost.pyroxene)} />
		{/if}
		{#if cost.tacticalCoins > 0}
			<Metric label={m.levelup_metric_coins()} value={formatInt(cost.tacticalCoins)} />
		{/if}
		{#if cost.apPackagePurchases > 0}
			<Metric
				label={m.levelup_metric_package({ name: packageName })}
				value={m.unit_times({ count: formatInt(cost.apPackagePurchases) })}
			/>
		{/if}
	</div>
{/snippet}

<Panel>
	{#if result.kind === 'invalid'}
		<p class="text-lg text-ink">{invalidMessage(result.field)}</p>
	{:else if result.kind === 'at_cap'}
		<p class="text-xl text-ink">{m.levelup_verdict_at_cap()}</p>
	{:else if result.kind === 'already'}
		<p class="text-xl text-ink">{m.levelup_verdict_already({ level: String(target) })}</p>
	{:else if result.kind === 'beyond_horizon'}
		<p class="text-xl text-ink">
			{m.levelup_verdict_beyond({ years: formatInt(HORIZON_DAYS / 365) })}
		</p>
	{:else if result.kind === 'reached'}
		{#if result.days === 0}
			<p class="text-xl text-ink">{m.levelup_verdict_reached_today({ level: String(target) })}</p>
		{:else}
			<p class="text-xl text-ink">
				{m.levelup_verdict_reached({
					level: String(target),
					days: m.unit_days({ count: formatInt(result.days) })
				})}
			</p>
			<p class="mb-3 text-sm text-navy">
				{m.levelup_verdict_reached_date({ date: formatDate(result.date) })}
			</p>
			{@render metrics(result.cost)}
		{/if}
	{:else}
		<p class="text-xl text-ink">
			{m.levelup_verdict_projected({
				date: formatDate(result.date),
				level: String(result.state.level)
			})}
		</p>
		<p class="mb-3 text-sm text-navy tabular-nums">
			{#if result.capDate}
				{m.levelup_verdict_projected_cap({ date: formatDate(result.capDate) })}
			{:else if result.expToNext !== null}
				{m.levelup_verdict_projected_exp({
					exp: formatInt(result.state.exp),
					need: formatInt(result.expToNext)
				})}
			{/if}
		</p>
		{@render metrics(result.cost)}
	{/if}

	{#if result.kind === 'reached' || result.kind === 'projected'}
		<p class="mt-3 text-xs leading-relaxed text-navy">{m.levelup_assumptions()}</p>
	{/if}
</Panel>
