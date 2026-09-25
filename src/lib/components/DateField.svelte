<!--
	날짜 입력칸. 값은 'YYYY-MM-DD' 문자열 그대로 주고받는다 (시간대가 끼어들지 않게).
-->
<script lang="ts">
	interface Props {
		label: string;
		value: string;
		/** 고를 수 있는 가장 이른 날짜 */
		min?: string;
	}

	let { label, value = $bindable(''), min }: Props = $props();
	const id = $props.id();
</script>

<div>
	<label for={id} class="mb-1 block text-sm text-navy">{label}</label>
	<input
		{id}
		type="date"
		{min}
		bind:value
		class="w-full rounded border border-navy/60 bg-surface px-3 py-2 text-ink tabular-nums focus:outline-2 focus:outline-brand-strong"
	/>
</div>
