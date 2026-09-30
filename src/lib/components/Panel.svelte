<!--
	패널층 (디자인 문서 5-2). 계산기의 모든 덩어리는 이 안에 놓인다.
	테두리 장식은 네 모서리의 + 표식 (2026-09-29 스타일 타일에서 결정). 장식은 테두리까지만 —
	패널 안(데이터층)에는 넣지 않는다. 모양을 바꿀 때는 이 파일만 고친다.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		/** 패널 머리의 제목. 없으면 생략 */
		title?: string;
		/** false면 모서리 + 표식을 뺀다 (패널 안에 패널을 넣을 때 등) */
		marks?: boolean;
		children: Snippet;
	}

	let { title, marks = true, children }: Props = $props();

	const CORNERS = [
		'-top-2 -left-1.5',
		'-top-2 -right-1.5',
		'-bottom-2 -left-1.5',
		'-bottom-2 -right-1.5'
	];
</script>

<section class="relative rounded-sm border border-navy/15 bg-surface p-4">
	{#if marks}
		{#each CORNERS as pos (pos)}
			<span
				class="pointer-events-none absolute {pos} text-xs leading-none font-bold text-brand select-none"
				aria-hidden="true">+</span
			>
		{/each}
	{/if}
	{#if title}
		<h2 class="mb-3 text-sm font-bold text-navy">{title}</h2>
	{/if}
	{@render children()}
</section>
