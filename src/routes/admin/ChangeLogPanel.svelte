<!--
	변경 기록 (docs/006 4-6, 6-2의 5). 한 번의 저장(한 트랜잭션)이 한 줄 — change_log_saves.
	누가: 나 / 다른 관리자 / SQL 편집기(사람 정보 없음). 관리자만 읽을 수 있다 (보안 규칙).
-->
<script lang="ts">
	import Panel from '$lib/components/Panel.svelte';
	import type { SaveLog } from './admin-data';
	import { actorLabel, formatKst, shortList, tableLabel } from './admin-data';

	let { saves, me }: { saves: SaveLog[]; me: string } = $props();
</script>

<Panel title="변경 기록">
	{#if saves.length === 0}
		<p class="text-sm text-navy">아직 기록이 없어요.</p>
	{:else}
		<ul class="flex flex-col divide-y divide-navy/10">
			{#each saves as s (s.tx)}
				<li class="flex flex-col gap-0.5 py-2.5 first:pt-0 last:pb-0">
					<div class="flex flex-wrap items-baseline gap-x-2 text-sm">
						<span class="font-num text-ink tabular-nums">{formatKst(s.at)}</span>
						<span class="font-medium text-navy">{actorLabel(s.actor, me)}</span>
						<span class="text-xs text-navy">{s.rows}행</span>
					</div>
					<p class="text-xs text-navy">
						{shortList(s.tables.map(tableLabel))}
						<span class="font-mono break-all"> · {shortList(s.keys, 2)}</span>
					</p>
				</li>
			{/each}
		</ul>
	{/if}
</Panel>
