<!--
	결과 카드. 판정(verdict.kind)으로 문구를 고르고 숫자만 채운다.
	판정 규칙 자체는 src/lib/calc/gacha.ts 에 있다 — 여기서 조건을 새로 만들지 않는다.

	모집 스택 (2026-10-23 결정)
	- 헤드라인은 늘 "확정이냐 부족이냐". 반천장까지만 닿는 경우(half_reachable)도 "천장까지 N개 부족"이 헤드라인이고
	  반천장은 확률이 크게 뛰는 지점이라는 보조 문장으로 내린다
	- 부족할 때는 쌓은 스택이 다음 모집으로 넘어간다는 것을 함께 알린다 (포인트 방식은 이월 없음)
	- 마일리지 티켓을 받는다는 미확인 가정에 기댄 결과는 문장으로 밝힌다
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { m } from '$lib/paraglide/messages.js';
	import type { GachaFailure, GachaResult } from '$lib/calc/gacha-adapter';
	import { formatInt, formatPercent, formatRate } from '$lib/format';
	import Panel, { type PanelTone } from '$lib/components/Panel.svelte';
	import Metric from '$lib/components/Metric.svelte';
	import Callout from '$lib/components/Callout.svelte';
	import Badge from '$lib/components/Badge.svelte';

	interface Props {
		result: GachaResult;
		bannerName: string;
		/** 스택 방식일 때 스택 이름 (모집 스택 / 특별 스택). 이월 안내 문장에 쓴다 */
		stackName?: string;
		/** 반천장의 픽업 확률, 표시용 문자열 (50%) */
		halfPickupChance?: string;
		/** 카드 아래쪽 동작 (공유 링크 복사 등) */
		actions?: Snippet;
	}

	let { result, bannerName, stackName, halfPickupChance = '', actions }: Props = $props();

	const failMessages: Record<GachaFailure, () => string> = {
		no_pity: m.pity_fail_no_pity,
		no_target_group: m.pity_fail_no_target_group,
		unknown_pool_size: m.pity_fail_unknown_pool_size,
		rule_unconfirmed: m.pity_fail_rule_unconfirmed
	};

	// 결과판의 판정 색 (2026-10-23 결정, 디자인 문서 5-18): 교환 가능·확정은 확보, 부족·반천장까지는 부족,
	// 계산할 수 없음(천장 없음 등)은 색 없음
	const tone: PanelTone = $derived(
		!result.ok
			? 'neutral'
			: result.evaluation.verdict.kind === 'exchange_now' ||
				  result.evaluation.verdict.kind === 'guaranteed'
				? 'secured'
				: 'shortfall'
	);
</script>

<Panel
	pulse={result}
	marks
	elevation="e2"
	{tone}
	class="font-num [view-transition-name:vt-result-pity]"
>
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
			<p
				class="flex flex-wrap items-center gap-2 text-[1.375rem] leading-snug font-bold text-ink md:text-2xl"
			>
				<Badge tone="secured">{m.pity_badge_secured()}</Badge>
				{m.pity_verdict_exchange_now()}
			</p>
		{:else if v.kind === 'guaranteed'}
			<p
				class="mb-3 flex flex-wrap items-center gap-2 text-[1.375rem] leading-snug font-bold text-ink md:text-2xl"
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
		{:else}
			<!-- short / half_reachable: 헤드라인은 천장까지 부족분 -->
			<p
				class="mb-3 flex flex-wrap items-center gap-2 text-[1.375rem] leading-snug font-bold text-ink md:text-2xl"
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
			{#if v.kind === 'half_reachable'}
				<p class="mt-3 text-sm leading-relaxed text-ink">
					{m.pity_half_reachable({
						count: formatInt(v.pullsToHalf),
						chance: halfPickupChance
					})}
				</p>
			{:else if v.halfShortfallGems !== undefined}
				<p class="mt-3 text-sm leading-relaxed text-ink">
					{m.pity_half_short({ gems: formatInt(v.halfShortfallGems) })}
				</p>
			{/if}
			{#if v.chargeIfMissed !== undefined && v.chargeIfMissed > 0 && stackName}
				<p class="mt-1 text-sm leading-relaxed text-navy">
					{m.pity_carry_note({ name: stackName, stack: formatInt(v.chargeIfMissed) })}
				</p>
			{/if}
		{/if}

		{#if result.mileageAssumed}
			<p class="mt-3 text-xs leading-relaxed text-navy">{m.pity_note_mileage_assumed()}</p>
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
			{#if result.evaluation.budget.fromMileage > 0}
				<dt>{m.pity_detail_mileage_pulls()}</dt>
				<dd class="text-right text-ink">
					{m.unit_pulls({ count: formatInt(result.evaluation.budget.fromMileage) })}
				</dd>
			{/if}
			<dt>{m.pity_detail_rate()}</dt>
			<dd class="text-right text-ink">{formatRate(result.ratePercent / 100)}</dd>
		</dl>
	{/if}
	{#if actions}
		<div class="mt-4 flex justify-end">{@render actions()}</div>
	{/if}
</Panel>
