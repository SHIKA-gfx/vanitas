<!--
	결과 카드. 판정(verdict.kind)으로 문구를 고르고 숫자만 채운다.
	판정 규칙 자체는 src/lib/calc/gacha.ts 에 있다 — 여기서 조건을 새로 만들지 않는다.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { m } from '$lib/paraglide/messages.js';
	import type { GachaFailure, GachaResult } from '$lib/calc/gacha-adapter';
	import { formatInt, formatPercent, formatRate } from '$lib/format';
	import Panel from '$lib/components/Panel.svelte';
	import Metric from '$lib/components/Metric.svelte';
	import Callout from '$lib/components/Callout.svelte';
	import Badge from '$lib/components/Badge.svelte';

	interface Props {
		result: GachaResult;
		bannerName: string;
		/** 카드 아래쪽 동작 (공유 링크 복사 등) */
		actions?: Snippet;
	}

	let { result, bannerName, actions }: Props = $props();

	const failMessages: Record<GachaFailure, () => string> = {
		no_pity: m.pity_fail_no_pity,
		no_target_group: m.pity_fail_no_target_group,
		unknown_pool_size: m.pity_fail_unknown_pool_size
	};
</script>

<Panel marks>
	<div class="mb-1 flex items-center gap-2 text-sm text-navy">
		<span>{bannerName}</span>
		{#if result.ok && !result.verified}
			<Badge>{m.pity_badge_estimated()}</Badge>
		{/if}
	</div>

	{#if !result.ok}
		<p class="text-lg font-bold text-ink">{failMessages[result.reason]()}</p>
	{:else}
		{@const v = result.evaluation.verdict}

		<!-- 판정 배지: 의미 색 + 글자 (색만으로 구분하지 않는다, 디자인 문서 2-4) -->
		{#if v.kind === 'exchange_now'}
			<p class="flex flex-wrap items-center gap-2 text-[1.375rem] leading-snug font-bold text-ink">
				<Badge tone="secured">{m.pity_badge_secured()}</Badge>
				{m.pity_verdict_exchange_now()}
			</p>
		{:else if v.kind === 'guaranteed'}
			<p
				class="mb-3 flex flex-wrap items-center gap-2 text-[1.375rem] leading-snug font-bold text-ink"
			>
				<Badge tone="secured">{m.pity_badge_secured()}</Badge>
				{m.pity_verdict_guaranteed()}
			</p>
			<div class="grid grid-cols-2 gap-2">
				<Metric
					label={m.pity_metric_before_pity()}
					value={formatPercent(v.probabilityBeforePity)}
				/>
				{#if v.leftoverGemsAtPity > 0}
					<Metric label={m.pity_metric_leftover()} value={formatInt(v.leftoverGemsAtPity)} />
				{:else}
					<p class="self-center text-sm text-navy">{m.pity_metric_leftover_none()}</p>
				{/if}
			</div>
		{:else if v.kind === 'short'}
			<p
				class="mb-3 flex flex-wrap items-center gap-2 text-[1.375rem] leading-snug font-bold text-ink"
			>
				<Badge tone="shortfall">{m.pity_badge_short()}</Badge>
				{m.pity_verdict_short({ gems: formatInt(v.shortfallGems) })}
			</p>
			<div class="grid grid-cols-2 gap-2">
				{#if v.probability !== null}
					<Metric label={m.pity_metric_probability()} value={formatPercent(v.probability)} />
				{/if}
				<Metric
					label={m.pity_metric_pulls_to_pity()}
					value={m.unit_pulls({ count: formatInt(v.shortfallPulls) })}
					tone="shortfall"
				/>
			</div>
		{:else}
			<p class="text-lg font-bold text-ink">{m.pity_verdict_unsupported()}</p>
		{/if}

		{#if !result.pickThroughObtainable}
			<div class="mt-3">
				<Callout>{m.pity_note_no_pick_through()}</Callout>
			</div>
		{/if}

		<dl class="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-navy tabular-nums">
			<dt>{m.pity_detail_total_pulls()}</dt>
			<dd class="text-right text-ink">
				{m.unit_pulls({ count: formatInt(result.evaluation.budget.total) })}
			</dd>
			<dt>{m.pity_detail_rate()}</dt>
			<dd class="text-right text-ink">{formatRate(result.ratePercent / 100)}</dd>
		</dl>
	{/if}
	{#if actions}
		<div class="mt-4 flex justify-end">{@render actions()}</div>
	{/if}
</Panel>
