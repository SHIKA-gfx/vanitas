<!--
	출처 목록 (docs/006 6-2의 4, ④-3). id 숫자 순. 등급·발행처·제목·날짜·주소·쓰이는 기간 수.
	출처는 지우지 않는다 — 예전 값의 근거로 남긴다
-->
<script lang="ts">
	import Badge from '$lib/components/Badge.svelte';
	import Panel from '$lib/components/Panel.svelte';
	import type { SourceEntry } from '$lib/data/db/convert';
	import AdminButton from './AdminButton.svelte';
	import { TIER_LABEL, type Tier, type Usage } from './catalog-edit';
	import type { SiteSync } from './recruit-edit';

	interface Props {
		sources: Record<string, SourceEntry>;
		usage: Usage;
		sync: SiteSync;
		onedit: (id: string | null) => void;
	}
	let { sources, usage, sync, onedit }: Props = $props();
	const ids = $derived(Object.keys(sources));
	const pending = $derived([...sync.byId.values()].filter((s) => s !== 'same').length);
</script>

<Panel title="출처 · {ids.length}건">
	<div class="flex flex-col gap-4">
		<div class="flex flex-wrap items-center gap-x-2 gap-y-3">
			<AdminButton variant="primary" onclick={() => onedit(null)}>새 출처</AdminButton>
			<p class="min-w-0 flex-1 text-xs text-navy">
				{pending === 0 ? '사이트와 같아요' : `사이트에 아직 반영되지 않은 출처 ${pending}건`}
			</p>
		</div>
		<ul class="flex flex-col divide-y divide-navy/10">
			{#each [...ids].reverse() as id (id)}
				{@const s = sources[id]}
				{@const state = sync.byId.get(id)}
				{@const used = usage.sources.get(id)?.length ?? 0}
				<li class="flex items-start gap-2 py-2">
					<span class="w-7 shrink-0 pt-0.5 text-right font-num text-sm text-navy">{id}</span>
					<div class="min-w-0 flex-1">
						<div class="flex flex-wrap items-center gap-x-2 gap-y-1">
							<Badge>{TIER_LABEL[s.tier as Tier] ?? s.tier}</Badge>
							{#if state === 'changed'}
								<Badge>반영 전</Badge>
							{:else if state === 'new'}
								<Badge>새 출처 · 반영 전</Badge>
							{/if}
							<span class="text-xs text-navy">{s.publisher}{s.date ? ` · ${s.date}` : ''}</span>
						</div>
						<p class="mt-0.5 text-sm text-ink">{s.title}</p>
						<p class="mt-0.5 text-xs break-all text-navy">
							{s.url ?? '주소 없음'}{used > 0 ? ` · 기간 ${used}개` : ''}
						</p>
					</div>
					<button
						type="button"
						class="inline-flex min-h-9 shrink-0 items-center px-1 text-sm font-bold text-brand-strong hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-strong"
						aria-label="출처 {id} 고치기"
						onclick={() => onedit(id)}>고치기</button
					>
				</li>
			{/each}
		</ul>
	</div>
</Panel>
