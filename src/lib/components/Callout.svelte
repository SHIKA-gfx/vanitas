<!--
	대화창 패턴 (디자인 문서 5-3). 판정·해설 문장 전용.
	흰 글자 on navy 10.35:1
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<div class="rounded-lg bg-navy px-4 py-3 text-sm leading-relaxed text-white">
	{@render children()}
</div>
