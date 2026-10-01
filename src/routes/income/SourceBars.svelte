<!--
	수급원별 비중. 도넛 대신 가로 막대 (기획서 3-1):
	팔레트가 파랑 계열뿐이라 조각을 색으로 구분하기 어렵고, 막대는 라벨을 옆에 직접 단다.
	티켓은 단위가 달라 막대 없이 아래에 따로 적는다.
-->
<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import type { SourceTotal } from '$lib/calc/income-adapter';
	import { formatInt } from '$lib/format';

	let { sources }: { sources: SourceTotal[] } = $props();

	const pyroxene = $derived(sources.filter((s) => s.unit === 'pyroxene'));
	const tickets = $derived(sources.filter((s) => s.unit === 'tenPullTicket'));
	const max = $derived(Math.max(1, ...pyroxene.map((s) => s.amount)));
</script>

<!-- 넓은 화면에서는 두 줄로 나눠 세로 길이를 줄인다 -->
<ul class="grid gap-x-5 gap-y-2 xl:grid-cols-2">
	{#each pyroxene as s (s.id)}
		<li>
			<div class="flex items-baseline justify-between gap-2 text-sm">
				<span class="break-keep text-ink">
					{s.name}
					{#if s.paid}<span
							class="ml-1 inline-block rounded border border-navy/25 px-1 py-px align-middle text-[0.6875rem] leading-none text-navy"
							>{m.income_bars_paid()}</span
						>{/if}
					{#if s.estimated}<span
							class="ml-1 inline-block rounded border border-navy/25 px-1 py-px align-middle text-[0.6875rem] leading-none text-navy"
							>{m.income_bars_estimated()}</span
						>{/if}
				</span>
				<span class="text-navy tabular-nums">{formatInt(s.amount)}</span>
			</div>
			<div class="mt-1.5 h-2 rounded-full bg-wash" aria-hidden="true">
				<div class="h-2 rounded-full bg-brand" style="width: {(s.amount / max) * 100}%"></div>
			</div>
		</li>
	{/each}
	{#each tickets as s (s.id)}
		<li class="flex items-baseline justify-between gap-2 text-sm">
			<span class="break-keep text-ink">
				{s.name}
				{#if s.estimated}<span
						class="ml-1 inline-block rounded border border-navy/25 px-1 py-px align-middle text-[0.6875rem] leading-none text-navy"
						>{m.income_bars_estimated()}</span
					>{/if}
			</span>
			<span class="text-navy tabular-nums">{m.unit_tickets({ count: formatInt(s.amount) })}</span>
		</li>
	{/each}
</ul>
