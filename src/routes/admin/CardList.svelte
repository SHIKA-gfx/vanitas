<!--
	묶음이 든 목록 (수급원·배너 종류처럼 줄마다 모양이 큰 것). 줄마다 접힌 카드 — 펼친 카드만 그린다.
	순서 ▲▼, 빼기 ✕, 더하기는 마지막 줄 복사
-->
<script lang="ts">
	import ObjectFields from './ObjectFields.svelte';
	import PrimitiveList from './PrimitiveList.svelte';
	import { copyOf, isObject, type Json } from './doc-edit';
	import { itemTitle } from './doc-sections';

	let { items, label, depth = 0 }: { items: Json[]; label: string; depth?: number } = $props();
	let open = $state<Record<number, boolean>>({});

	function move(i: number, d: -1 | 1) {
		const [item] = items.splice(i, 1);
		items.splice(i + d, 0, item);
		open = {};
	}
	function remove(i: number) {
		if (!confirm(`${label}의 "${itemTitle(items[i], i)}" 줄을 뺄까요?`)) return;
		items.splice(i, 1);
		open = {};
	}
	const SMALL =
		'grid h-9 w-7 shrink-0 place-items-center text-navy hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-strong disabled:opacity-30';
</script>

<div class="flex flex-col gap-2">
	{#each items as item, i (i)}
		<div class="rounded-lg bg-wash">
			<div class="flex items-center gap-1 pr-1">
				<button
					type="button"
					class="flex min-h-11 min-w-0 flex-1 items-center gap-2 px-3 text-left text-sm font-medium text-ink focus-visible:outline-2 focus-visible:outline-brand-strong"
					aria-expanded={open[i] ?? false}
					onclick={() => (open[i] = !open[i])}
				>
					<span aria-hidden="true" class="text-xs text-navy">{open[i] ? '▾' : '▸'}</span>
					<span class="truncate">{itemTitle(item, i)}</span>
				</button>
				<button
					type="button"
					class={SMALL}
					aria-label="{itemTitle(item, i)} 위로"
					disabled={i === 0}
					onclick={() => move(i, -1)}>▲</button
				>
				<button
					type="button"
					class={SMALL}
					aria-label="{itemTitle(item, i)} 아래로"
					disabled={i === items.length - 1}
					onclick={() => move(i, 1)}>▼</button
				>
				<button
					type="button"
					class="{SMALL} text-xs"
					aria-label="{itemTitle(item, i)} 빼기"
					onclick={() => remove(i)}>✕</button
				>
			</div>
			{#if open[i]}
				<div class="border-t border-navy/10 p-3">
					{#if isObject(item)}
						<ObjectFields obj={item} depth={depth + 1} />
					{:else if Array.isArray(item)}
						<PrimitiveList list={item} label="{label} {i + 1}" />
					{/if}
				</div>
			{/if}
		</div>
	{/each}
	<button
		type="button"
		class="self-start px-1 text-xs font-bold text-brand-strong hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-strong"
		onclick={() => {
			items.push(copyOf(items[items.length - 1]));
			open = { [items.length - 1]: true };
		}}>＋ 줄 더하기 (마지막 줄 복사)</button
	>
</div>
