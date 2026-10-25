<!--
	부족분 메우기 — 계획 판 "부족" 줄 안의 접기 (docs/005 9장, 디자인 문서 5-20).
	"부족"인 목표를 그 기간까지 데려오려면 수급 조건을 어떻게 바꾸면 되는지, 바꾸는 순서대로 쌓아 보여준다.

	- 계산은 펼쳤을 때만 한다 — 조건마다 플래너를 다시 돌리므로 (planner-fill.ts)
	- 권하지 않는다 (2026-10-25 결정): 무료 방법이 먼저, 과금은 "과금" 배지 + 사실(+N개)만. 가격 비교·추천 문장 없음
	- 판정 문법은 5-18·5-20 그대로: 확보되는 단계에 "확보" 배지, 다 바꿔도 모자라면 "부족" 배지. 색만으로 말하지 않는다
	- 단계는 쌓인다 (앞 단계를 모두 한 상태에서 다음 단계). 왼쪽 세로 선이 그 이어짐을 보여준다
	- 우선순위는 그대로: 이 목표가 확보되며 밀려나는 뒤 순위 목표는 "대신 부족"으로 그 부족분과 함께 알린다
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Pathname } from '$app/types';
	import { m } from '$lib/paraglide/messages.js';
	import { localizeHref } from '$lib/paraglide/runtime.js';
	import { formatInt } from '$lib/format';
	import Badge from '$lib/components/Badge.svelte';
	import { SUBSCRIPTION_MAX_COUNT } from '$lib/state/income-settings';
	import type { FillLever, FillStep, ShortfallFill } from '$lib/calc/planner-fill';

	interface Props {
		/** 줄에 부족 목표가 여럿이면 접기 이름에 붙인다 */
		name?: string;
		/** 펼쳤을 때 계산한다 */
		fill: () => ShortfallFill | null;
		/** 목표 순서 번호 → "N순위 이름" (함께 확보·대신 부족) */
		labelOf: (index: number) => string;
	}

	let { name, fill, labelOf }: Props = $props();

	let open = $state(false);
	const result = $derived(open ? fill() : null);

	/** 정액 상품 구매 횟수 — 수급 계산기 선택지와 같은 이름 */
	function countText(count: number): string {
		if (count === 0) return m.income_subscription_none();
		if (count > SUBSCRIPTION_MAX_COUNT) return m.income_subscription_continuous();
		return m.planner_fill_count({ count: formatInt(count) });
	}

	function leverText(l: FillLever): string {
		switch (l.kind) {
			case 'source':
				return l.participation
					? m.planner_fill_event({ name: l.name, participation: l.participation })
					: m.planner_fill_source({ name: l.name });
			case 'raidTier':
				return m.planner_fill_raid_tier({ from: l.from, to: l.to });
			case 'tacticalRank':
				return m.planner_fill_tactical({
					from: formatInt(l.from),
					to: formatInt(l.to),
					rank: l.rank
				});
			case 'participation':
				return m.planner_fill_participation({ from: l.from, to: l.to });
			case 'apPurchases':
				return m.planner_fill_ap({ from: formatInt(l.from) });
			case 'subscription':
				return m.planner_fill_subscription({
					name: l.name,
					from: countText(l.from),
					to: countText(l.to)
				});
		}
	}

	/** 효과: 청휘석, 티켓으로 받는 보상이면 장수 */
	const gainText = (s: FillStep) =>
		s.gainTickets > 0 && s.gainGems === 0
			? m.planner_fill_gain_tickets({ count: formatInt(s.gainTickets) })
			: m.planner_fill_gain({ gems: formatInt(s.gainGems) });
</script>

<details bind:open class="group rounded-lg bg-white/85">
	<summary
		class="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-3 text-sm text-navy hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-strong"
	>
		<span>{name ? m.planner_fill_toggle_named({ name }) : m.planner_fill_toggle()}</span>
		<span
			aria-hidden="true"
			class="transition-transform group-open:rotate-180 motion-reduce:transition-none">▾</span
		>
	</summary>
	{#if result}
		<div class="flex flex-col gap-3 px-3 pb-3">
			{#if result.steps.length > 0}
				<ol class="flex flex-col border-l-2 border-navy/15">
					{#each result.steps as step, i (i)}
						<li class="flex flex-col gap-1 py-1.5 pl-3">
							<p class="flex items-baseline justify-between gap-3 text-sm text-ink">
								<span class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
									{#if step.kind === 'paid'}<Badge>{m.planner_fill_badge_paid()}</Badge>{/if}
									<span>{leverText(step.lever)}</span>
								</span>
								<span class="shrink-0 font-bold tabular-nums">{gainText(step)}</span>
							</p>
							{#if result.securedAt === i}
								<p class="flex flex-wrap items-center gap-2 text-sm font-bold text-ink">
									<Badge tone="secured">{m.planner_badge_secured()}</Badge>
									{m.planner_fill_secured_here()}
								</p>
							{:else}
								<p class="text-xs text-navy">
									{m.planner_fill_remaining({ gems: formatInt(step.remainingAfter) })}
								</p>
							{/if}
							{#if step.alsoSecured.length > 0}
								<p class="text-xs text-navy">
									{m.planner_fill_also_secured({ names: step.alsoSecured.map(labelOf).join(', ') })}
								</p>
							{/if}
							{#each step.alsoLost as lost (lost.index)}
								<p class="text-xs font-bold text-ink">
									{m.planner_fill_also_lost({
										name: labelOf(lost.index),
										gems: formatInt(lost.shortfallGems)
									})}
								</p>
							{/each}
						</li>
					{/each}
				</ol>
				{#if result.securedAt === null}
					<p class="flex flex-wrap items-center gap-2 text-sm font-bold text-ink">
						<Badge tone="shortfall">{m.planner_badge_short()}</Badge>
						{m.planner_fill_still_short({ gems: formatInt(result.remaining) })}
					</p>
				{/if}
			{:else}
				<p class="text-sm text-navy">{m.planner_fill_none()}</p>
			{/if}
			<div class="flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
				<p class="min-w-0 flex-1 basis-56 text-xs text-navy">{m.planner_fill_note()}</p>
				<a
					href={resolve(localizeHref('/income') as Pathname)}
					class="text-sm text-ink underline underline-offset-4 hover:text-brand-strong"
				>
					{m.planner_income_edit()}
				</a>
			</div>
		</div>
	{/if}
</details>
