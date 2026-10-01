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
		/** 입력 오류 안내. 있으면 테두리가 blocked 색이 되고 칸 아래에 문장이 나온다 */
		error?: string;
	}

	let { label, value = $bindable(), options, help, error }: Props = $props();
	const id = $props.id();
	let helpOpen = $state(false);

	const describedBy = $derived(
		[error ? `${id}-error` : '', help && helpOpen ? `${id}-help` : ''].filter(Boolean).join(' ') ||
			undefined
	);
</script>

<div>
	<div class="mb-2 flex min-h-6 items-center gap-1.5">
		<label for={id} class="block text-[0.8125rem] font-medium text-navy">{label}</label>
		{#if help}
			<HelpButton {label} controls="{id}-help" bind:open={helpOpen} />
		{/if}
	</div>
	<!-- 브라우저 기본 화살표 대신 직접 그린다 (2026-10-01) -->
	<div class="relative">
		<select
			{id}
			bind:value
			aria-describedby={describedBy}
			aria-invalid={error ? true : undefined}
			class="field appearance-none pr-10 {error ? 'field-error' : ''}"
		>
			{#each options as option (option.value)}
				<option value={option.value}>{option.label}</option>
			{/each}
		</select>
		<svg
			class="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-navy/60"
			viewBox="0 0 16 16"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<path d="m4 6 4 4 4-4" />
		</svg>
	</div>
	{#if error}
		<p id="{id}-error" class="mt-2 text-xs font-bold text-blocked">{error}</p>
	{/if}
	{#if help}
		<p
			id="{id}-help"
			hidden={!helpOpen}
			class="mt-2 rounded-lg bg-wash p-3 text-xs leading-relaxed text-navy"
		>
			{help}
		</p>
	{/if}
</div>
