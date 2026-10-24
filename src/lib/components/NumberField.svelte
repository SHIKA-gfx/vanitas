<!--
	정수 입력칸. 청휘석·모집권·포인트처럼 0 이상의 정수만 받는다.
	잘못된 값(빈칸, 음수, 소수)은 즉시 보정한다.
	칸을 벗어나면 쉼표를 넣어 보여주고(27,711), 입력 중에는 숫자만 보여준다 (2026-10-01, 결과 표기와 맞춤).
	help를 주면 라벨 옆에 "?" 버튼이 붙는다 (SelectField와 같은 방식).

	모양 (2026-10-23, 5-19): 판에 파인 홈 48px (layout.css의 field). 초점이 오면 흰 바탕으로 떠오른다.
	단위(unit)를 주면 칸 안 오른쪽에 붙는다 (개·장·회 — 숫자만으론 무엇을 세는지 모호한 칸만, 8-2 C 결정).
	단위는 화면 낭독기에도 전한다 (aria-describedby).
	라벨 앞 60° 막대: 장식이 아니라 라벨의 자리 표시. 오류면 blocked (2026-10-23, 5-19)
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
		/** 칸 안 오른쪽의 단위 (개, 장, 회) */
		unit?: string;
	}

	let {
		label,
		value = $bindable(0),
		min = 0,
		max = Number.MAX_SAFE_INTEGER,
		hint,
		help,
		error,
		unit
	}: Props = $props();
	const id = $props.id();
	let helpOpen = $state(false);
	let focused = $state(false);

	const describedBy = $derived(
		[
			unit ? `${id}-unit` : '',
			error ? `${id}-error` : '',
			hint ? `${id}-hint` : '',
			help && helpOpen ? `${id}-help` : ''
		]
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
	<!-- 숫자 쉼표를 보여주려고 type="number" 대신 text + inputmode="numeric" -->
	<div class="relative">
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
			class="field font-num {unit ? 'pr-10' : ''} {error ? 'field-error' : ''}"
		/>
		{#if unit}
			<span
				id="{id}-unit"
				aria-hidden="true"
				class="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-[0.8125rem] text-navy"
				>{unit}</span
			>
		{/if}
	</div>
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
			class="mt-2 rounded-lg bg-slot p-3 text-xs leading-relaxed text-navy shadow-[inset_0_1px_2px_rgb(42_66_91/0.1)]"
		>
			{help}
		</p>
	{/if}
</div>
