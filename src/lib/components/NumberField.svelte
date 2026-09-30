<!--
	정수 입력칸. 청휘석·모집권·포인트처럼 0 이상의 정수만 받는다.
	잘못된 값(빈칸, 음수, 소수)은 즉시 보정하고, 칸을 벗어날 때 표시도 맞춘다.
	help를 주면 라벨 옆에 "?" 버튼이 붙는다 (SelectField와 같은 방식).
-->
<script lang="ts">
	import HelpButton from './HelpButton.svelte';

	interface Props {
		label: string;
		value: number;
		min?: number;
		max?: number;
		/** 칸 아래 작은 안내 (예: 하루 청휘석 소모량) */
		hint?: string;
		/** 왜 이 값을 묻는지, 값이 어떻게 쓰이는지 설명하는 문단 */
		help?: string;
		/** 입력 오류 안내. 있으면 테두리가 blocked 색이 되고 칸 아래에 문장이 나온다 */
		error?: string;
	}

	let {
		label,
		value = $bindable(0),
		min = 0,
		max = Number.MAX_SAFE_INTEGER,
		hint,
		help,
		error
	}: Props = $props();
	const id = $props.id();
	let helpOpen = $state(false);

	const describedBy = $derived(
		[error ? `${id}-error` : '', hint ? `${id}-hint` : '', help && helpOpen ? `${id}-help` : '']
			.filter(Boolean)
			.join(' ') || undefined
	);

	function clamp(raw: string): number {
		const n = Math.floor(Number(raw));
		if (!Number.isFinite(n)) return min;
		return Math.min(max, Math.max(min, n));
	}

	function onInput(event: Event & { currentTarget: HTMLInputElement }) {
		value = clamp(event.currentTarget.value);
	}

	function onBlur(event: Event & { currentTarget: HTMLInputElement }) {
		event.currentTarget.value = String(value);
	}
</script>

<div>
	<div class="mb-1 flex min-h-6 items-center gap-1.5">
		<label for={id} class="block text-sm text-navy">{label}</label>
		{#if help}
			<HelpButton {label} controls="{id}-help" bind:open={helpOpen} />
		{/if}
	</div>
	<!-- 테두리 navy/60: 흰 바탕 대비 약 3.4:1 (입력칸 기준 3:1) -->
	<input
		{id}
		type="number"
		inputmode="numeric"
		step="1"
		{min}
		{max}
		{value}
		aria-describedby={describedBy}
		aria-invalid={error ? true : undefined}
		oninput={onInput}
		onblur={onBlur}
		class="w-full rounded border bg-surface px-3 py-2 text-ink tabular-nums focus:outline-2 focus:outline-brand-strong {error
			? 'border-blocked ring-1 ring-blocked'
			: 'border-navy/60'}"
	/>
	{#if error}
		<p id="{id}-error" class="mt-1 text-xs font-bold text-blocked">{error}</p>
	{/if}
	{#if hint}
		<p id="{id}-hint" class="mt-1 text-xs text-navy tabular-nums">{hint}</p>
	{/if}
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
