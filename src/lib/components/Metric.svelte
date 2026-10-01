<!--
	결과 숫자 하나 + 설명 한 줄. 데이터층 (디자인 문서 5-2) — 장식을 넣지 않는다.
	tone으로 숫자에 의미 색을 입힐 수 있다 (부족은 글자용 shortfall-strong).
-->
<script lang="ts">
	import type { Tone } from './Badge.svelte';

	interface Props {
		label: string;
		value: string;
		tone?: Tone;
	}

	let { label, value, tone = 'neutral' }: Props = $props();

	const VALUE_CLASS: Record<Tone, string> = {
		neutral: 'text-ink',
		secured: 'text-secured',
		shortfall: 'text-shortfall-strong',
		blocked: 'text-blocked'
	};
</script>

<div class="rounded-xl bg-wash p-4">
	<div class="text-xl font-bold tabular-nums {VALUE_CLASS[tone]}">{value}</div>
	<div class="mt-1 text-xs text-navy">{label}</div>
</div>
