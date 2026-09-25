<!--
	작은 상태 표시. 의미 색이 정해지기 전까지는 중립 테두리만 쓴다 (디자인 문서 2-4).
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<span class="inline-block rounded border border-navy/60 px-1.5 text-xs text-navy">
	{@render children()}
</span>
