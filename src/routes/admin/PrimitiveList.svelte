<!--
	원시값 목록 (출처 번호·메모 줄·기간 일수 등). 줄마다 칸 + 빼기, 끝에 더하기.
	더하는 줄의 형은 목록의 첫 값을 따른다 (비어 있으면 글자)
-->
<script lang="ts">
	import PrimitiveInput from './PrimitiveInput.svelte';
	import type { Json } from './doc-edit';

	let { list, label }: { list: Json[]; label: string } = $props();

	function add() {
		const first = list[0];
		list.push(typeof first === 'number' ? 0 : typeof first === 'boolean' ? false : '');
	}
</script>

<div class="flex flex-col gap-1.5">
	{#each list, i (i)}
		<div class="flex items-start gap-1">
			<div class="min-w-0 flex-1">
				<PrimitiveInput parent={list} key={i} label="{label} {i + 1}" />
			</div>
			<button
				type="button"
				class="grid h-10 w-8 shrink-0 place-items-center text-sm text-navy hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-strong"
				aria-label="{label} {i + 1} 빼기"
				onclick={() => list.splice(i, 1)}>✕</button
			>
		</div>
	{/each}
	<button
		type="button"
		class="self-start px-1 text-xs font-bold text-brand-strong hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-strong"
		onclick={add}>＋ 줄 더하기</button
	>
</div>
