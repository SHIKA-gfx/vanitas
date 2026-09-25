<!--
	선택 칸. help를 주면 라벨 옆에 "?" 버튼이 붙고, 누르면 칸 아래에 설명이 펼쳐진다.
-->
<script lang="ts">
	import HelpButton from './HelpButton.svelte';

	interface Option {
		value: string;
		label: string;
	}

	interface Props {
		label: string;
		value: string;
		options: Option[];
		/** 왜 이 값을 묻는지 설명하는 문단 */
		help?: string;
	}

	let { label, value = $bindable(), options, help }: Props = $props();
	const id = $props.id();
	let helpOpen = $state(false);
</script>

<div>
	<div class="mb-1 flex min-h-6 items-center gap-1.5">
		<label for={id} class="block text-sm text-navy">{label}</label>
		{#if help}
			<HelpButton {label} controls="{id}-help" bind:open={helpOpen} />
		{/if}
	</div>
	<select
		{id}
		bind:value
		aria-describedby={help && helpOpen ? `${id}-help` : undefined}
		class="w-full rounded border border-navy/60 bg-surface px-3 py-2 text-ink focus:outline-2 focus:outline-brand-strong"
	>
		{#each options as option (option.value)}
			<option value={option.value}>{option.label}</option>
		{/each}
	</select>
	{#if help}
		<p
			id="{id}-help"
			hidden={!helpOpen}
			class="mt-2 rounded bg-wash p-3 text-xs leading-relaxed text-navy"
		>
			{help}
		</p>
	{/if}
</div>
