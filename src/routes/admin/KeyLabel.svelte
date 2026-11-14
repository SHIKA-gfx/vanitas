<!-- 칸 이름: 한국어 이름이 있으면 함께, 없으면 키 그대로 (doc-sections.ts KEY_LABELS, label로 바꿀 수 있다) -->
<script lang="ts">
	import { KEY_LABELS } from './doc-sections';
	let {
		name,
		label: override,
		class: className = ''
	}: { name: string; label?: string; class?: string } = $props();
	const label = $derived(override ?? KEY_LABELS[name]);
</script>

<span class={className}>
	{#if label && label !== name}
		{label} <span class="font-mono text-[0.6875rem] font-normal text-navy/80">{name}</span>
	{:else}
		<span class="font-mono">{name}</span>
	{/if}
</span>
