<!--
	패널층 (디자인 문서 5-2). 계산기의 모든 덩어리는 이 안에 놓인다.
	장식(격자·+ 표식·기울인 탭)은 디자인 통일 작업 때 이 파일에만 추가한다.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		/** 패널 머리의 제목. 없으면 생략 */
		title?: string;
		children: Snippet;
	}

	let { title, children }: Props = $props();
</script>

<section class="rounded-md border border-navy/15 bg-surface p-4">
	{#if title}
		<h2 class="mb-3 text-sm text-navy">{title}</h2>
	{/if}
	{@render children()}
</section>
