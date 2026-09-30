<!--
	날짜 입력칸. 값은 'YYYY-MM-DD' 문자열 그대로 주고받는다 (시간대가 끼어들지 않게).
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
	<label for={id} class="mb-1 block text-sm text-navy">{label}</label>
	<input
		{id}
		type="date"
		{min}
		bind:value
		aria-describedby={error ? `${id}-error` : undefined}
		aria-invalid={error ? true : undefined}
		class="w-full rounded border bg-surface px-3 py-2 text-ink tabular-nums focus:outline-2 focus:outline-brand-strong {error
			? 'border-blocked ring-1 ring-blocked'
			: 'border-navy/60'}"
	/>
	{#if error}
		<p id="{id}-error" class="mt-1 text-xs font-bold text-blocked">{error}</p>
	{/if}
</div>
