<!--
	선택 칸. help를 주면 라벨 옆에 "?" 버튼이 붙고, 누르면 칸 아래에 설명이 펼쳐진다.
	모양은 입력칸과 같은 판에 파인 홈 (layout.css의 field, 5-19). 화살표만 다르다.
	라벨 앞 60° 막대: 장식이 아니라 라벨의 자리 표시. 오류면 blocked (2026-10-23, 5-19)
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
		<label for={id} class="flex items-center gap-2 text-[0.8125rem] font-medium text-navy">
			<span
				aria-hidden="true"
				class="h-3 w-[3px] shrink-0 -skew-x-30 rounded-[1px_1.5px] {error
					? 'bg-blocked'
					: 'bg-brand'}"
			></span>
			{label}
		</label>
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
			class="mt-2 rounded-lg bg-slot p-3 text-xs leading-relaxed text-navy shadow-[inset_0_1px_2px_rgb(42_66_91/0.1)]"
		>
			{help}
		</p>
	{/if}
</div>
