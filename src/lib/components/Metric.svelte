<!--
	결과 숫자 하나 + 설명 한 줄. 데이터층 (디자인 문서 5-2) — 장식을 넣지 않는다.
	tone으로 숫자에 의미 색을 입힐 수 있다 (부족은 글자용 shortfall-strong).
	칸 바탕 (2026-10-23, 5-19): 보통은 wash, 판정 색을 입힌 결과판 안에서는 흰색 86% + 머리카락 테두리.
	옅은 파랑 판 위의 wash 칸은 1.01~1.08:1이라 칸이 사라진다. 숫자는 22px(모바일 20px) — 판정 문장보다 작게 (5-14)
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

<div
	class="rounded-xl bg-wash p-4 group-data-tinted/plate:bg-surface/86 group-data-tinted/plate:shadow-[inset_0_1px_0_#fff,0_0_0_1px_rgb(42_66_91/0.08)]"
>
	<div class="font-num text-xl font-bold tabular-nums md:text-[1.375rem] {VALUE_CLASS[tone]}">
		{value}
	</div>
	<div class="mt-1 text-xs text-navy">{label}</div>
</div>
