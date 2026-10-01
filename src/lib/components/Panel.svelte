<!--
	패널층 (디자인 문서 5-2). 계산기의 모든 덩어리는 이 안에 놓인다.
	모양 (2026-10-01): 흰 바탕, 아주 연한 테두리 + 옅은 그림자 하나, 모서리 12px, 안쪽 여백 16(모바일)·24px.
	패널 안에는 진한 선을 두지 않는다 — 구역은 여백과 옅은 바탕으로 나눈다.

	모서리 + 표식은 결과 패널에만 (marks). "답이 있는 곳"을 표시하는 장치 (2026-10-01, A안).
	표식 모양은 CornerMark.svelte.
	처음에는 모든 패널에 달았는데, 패널이 붙은 곳에서 겹쳐 보이고 선이 많은 화면에 소음을 더했다.
	모양을 바꿀 때는 이 파일만 고친다.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import CornerMark, { type Corner } from './CornerMark.svelte';

	interface Props {
		/** 패널 머리의 제목. 없으면 생략 */
		title?: string;
		/** true면 네 모서리에 + 표식 (결과 패널) */
		marks?: boolean;
		/** 배치용 클래스 (예: 칸 높이에 맞춰 늘이기 xl:flex-1) */
		class?: string;
		children: Snippet;
	}

	let { title, marks = false, class: className = '', children }: Props = $props();

	const CORNERS: Corner[] = ['tl', 'tr', 'bl', 'br'];
</script>

<section
	class="relative rounded-xl border border-navy/10 bg-surface p-4 shadow-panel md:p-6 {className}"
>
	{#if marks}
		{#each CORNERS as corner (corner)}
			<CornerMark {corner} />
		{/each}
	{/if}
	{#if title}
		<h2 class="mb-4 text-base font-bold text-ink">{title}</h2>
	{/if}
	{@render children()}
</section>
