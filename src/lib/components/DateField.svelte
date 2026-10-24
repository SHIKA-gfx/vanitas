<!--
	날짜 입력칸. 값은 'YYYY-MM-DD' 문자열 그대로 주고받는다 (시간대가 끼어들지 않게).
	모양은 입력칸과 같은 판에 파인 홈 (layout.css의 field, 5-19). 라벨 앞 60° 막대: 장식이 아니라 라벨의 자리 표시. 오류면 blocked (2026-10-23, 5-19)
-->
<script lang="ts">
	interface Props {
		label: string;
		value: string;
		/** 고를 수 있는 가장 이른 날짜 */
		min?: string;
		/** 입력 오류 안내. 있으면 테두리가 blocked 색이 되고 칸 아래에 문장이 나온다 */
		error?: string;
	}

	let { label, value = $bindable(''), min, error }: Props = $props();
	const id = $props.id();
</script>

<div>
	<label
		for={id}
		class="mb-2 flex min-h-6 items-center gap-2 text-[0.8125rem] font-medium text-navy"
	>
		<span
			aria-hidden="true"
			class="h-3 w-[3px] shrink-0 -skew-x-30 rounded-[1px_1.5px] {error
				? 'bg-blocked'
				: 'bg-brand'}"
		></span>
		{label}
	</label>
	<input
		{id}
		type="date"
		{min}
		bind:value
		aria-describedby={error ? `${id}-error` : undefined}
		aria-invalid={error ? true : undefined}
		class="field font-num tabular-nums {error ? 'field-error' : ''}"
	/>
	{#if error}
		<p id="{id}-error" class="mt-2 text-xs font-bold text-blocked">{error}</p>
	{/if}
</div>
