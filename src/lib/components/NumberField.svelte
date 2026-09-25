<!--
	정수 입력칸. 청휘석·모집권·포인트처럼 0 이상의 정수만 받는다.
	잘못된 값(빈칸, 음수, 소수)은 즉시 보정하고, 칸을 벗어날 때 표시도 맞춘다.
-->
<script lang="ts">
	interface Props {
		label: string;
		value: number;
		min?: number;
		max?: number;
	}

	let { label, value = $bindable(0), min = 0, max = Number.MAX_SAFE_INTEGER }: Props = $props();
	const id = $props.id();

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
	<label for={id} class="mb-1 block text-sm text-navy">{label}</label>
	<!-- 테두리 navy/60: 흰 바탕 대비 약 3.4:1 (입력칸 기준 3:1) -->
	<input
		{id}
		type="number"
		inputmode="numeric"
		step="1"
		{min}
		{max}
		{value}
		oninput={onInput}
		onblur={onBlur}
		class="w-full rounded border border-navy/60 bg-surface px-3 py-2 text-ink tabular-nums focus:outline-2 focus:outline-brand-strong"
	/>
</div>
