<!--
	결과 숫자 하나 + 설명 한 줄. 데이터층 (디자인 문서 5-2) — 장식을 넣지 않는다.
	tone으로 숫자에 의미 색을 입힐 수 있다 (부족은 글자용 shortfall-strong).
	칸 바탕 (2026-10-23, 5-19): 보통은 wash, 판정 색을 입힌 결과판 안에서는 흰색 86% + 머리카락 테두리.
	옅은 파랑 판 위의 wash 칸은 1.01~1.08:1이라 칸이 사라진다. 숫자는 칸 폭에 따라 18~22px — 판정 문장보다 작게 (5-14)
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

<!--
	숫자 크기는 화면 폭이 아니라 칸 폭을 따른다 (2026-10-23, 컨테이너 쿼리): 넓은 칸 22px, 보통 20px, 좁은 칸 18px.
	수급 결과처럼 세 칸이 한 줄에 놓이면 칸이 90px 안팎까지 좁아져 "1,718"이 "1,71 / 8"로 끊겼다.
	숫자는 줄을 바꾸지 않는다 (whitespace-nowrap)
-->
<div
	class="@container rounded-xl bg-wash group-data-tinted/plate:bg-surface/86 group-data-tinted/plate:shadow-[inset_0_1px_0_#fff,0_0_0_1px_rgb(42_66_91/0.08)]"
>
	<div class="p-3 @min-[8rem]:p-4">
		<div
			class="font-num text-lg font-bold whitespace-nowrap tabular-nums @min-[6.5rem]:text-xl @min-[9rem]:text-[1.375rem] {VALUE_CLASS[
				tone
			]}"
		>
			{value}
		</div>
		<div class="mt-1 text-xs text-navy">{label}</div>
	</div>
</div>
