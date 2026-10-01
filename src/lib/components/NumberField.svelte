<!--
	정수 입력칸. 청휘석·모집권·포인트처럼 0 이상의 정수만 받는다.
	잘못된 값(빈칸, 음수, 소수)은 즉시 보정한다.
	칸을 벗어나면 쉼표를 넣어 보여주고(27,711), 입력 중에는 숫자만 보여준다 (2026-10-01, 결과 표기와 맞춤).
	help를 주면 라벨 옆에 "?" 버튼이 붙는다 (SelectField와 같은 방식).

	모양 (디자인 문서 5-8, 2026-10-01): 옅은 바탕(wash) + 테두리 없음, 높이 44px, 모서리 8px.
	초점이 오면 흰 바탕 + brand-strong 테두리 + 옅은 빛 번짐. 오류면 blocked.
-->
<script lang="ts">
	import { formatInt } from '$lib/format';
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
	let focused = $state(false);

	const describedBy = $derived(
		[error ? `${id}-error` : '', hint ? `${id}-hint` : '', help && helpOpen ? `${id}-help` : '']
			.filter(Boolean)
			.join(' ') || undefined
	);

	/** 쉼표·공백을 빼고 정수로 읽어 범위 안으로 */
	function clamp(raw: string): number {
		const n = Math.floor(Number(raw.replace(/[^\d.-]/g, '')));
		if (!Number.isFinite(n)) return min;
		return Math.min(max, Math.max(min, n));
	}

	function onInput(event: Event & { currentTarget: HTMLInputElement }) {
		value = clamp(event.currentTarget.value);
	}
</script>

<div>
	<div class="mb-2 flex min-h-6 items-center gap-1.5">
		<label for={id} class="block text-[0.8125rem] font-medium text-navy">{label}</label>
		{#if help}
			<HelpButton {label} controls="{id}-help" bind:open={helpOpen} />
		{/if}
	</div>
	<!-- 숫자 쉼표를 보여주려고 type="number" 대신 text + inputmode="numeric" -->
	<input
		{id}
		type="text"
		inputmode="numeric"
		autocomplete="off"
		value={focused ? String(value) : formatInt(value)}
		aria-describedby={describedBy}
		aria-invalid={error ? true : undefined}
		oninput={onInput}
		onfocus={() => (focused = true)}
		onblur={() => (focused = false)}
		class="field {error ? 'field-error' : ''}"
	/>
	{#if error}
		<p id="{id}-error" class="mt-2 text-xs font-bold text-blocked">{error}</p>
	{/if}
	{#if hint}
		<p id="{id}-hint" class="mt-2 text-xs text-navy tabular-nums">{hint}</p>
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
