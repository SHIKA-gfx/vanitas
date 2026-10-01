<!--
	결과 패널 네 모서리의 표식 (디자인 문서 5-2). Panel이 marks일 때 그린다.
	표식의 중심이 패널 모서리에 오도록 놓고, 오른쪽·아래 모서리는 거울처럼 뒤집는다.
	바탕을 흰색(surface)으로 채운 모양은 패널 테두리 위에 깔끔하게 얹힌다.

	variant (2026-10-01 시안 — 스타일 타일에서 비교 후 하나로 정한다)
	  plus     지금의 가는 십자
	  bold     굵은 십자
	  ring     원 테두리 안의 십자
	  diamond  마름모 테두리 안의 십자
	  bracket  십자 + 모서리를 따라 뻗는 굵은 선 (뷰파인더 느낌)
-->
<script lang="ts" module>
	export type CornerMarkVariant = 'plus' | 'bold' | 'ring' | 'diamond' | 'bracket';
	export type Corner = 'tl' | 'tr' | 'bl' | 'br';
</script>

<script lang="ts">
	interface Props {
		corner: Corner;
		variant?: CornerMarkVariant;
	}

	let { corner, variant = 'bold' }: Props = $props();

	/** 표식 중심(9,9)이 패널 모서리에 오도록 9px 바깥에 놓는다 */
	const POSITION: Record<Corner, string> = {
		tl: '-top-[9px] -left-[9px]',
		tr: '-top-[9px] -right-[9px] -scale-x-100',
		bl: '-bottom-[9px] -left-[9px] -scale-y-100',
		br: '-bottom-[9px] -right-[9px] -scale-100'
	};
</script>

<svg
	class="pointer-events-none absolute size-10 text-brand {POSITION[corner]}"
	viewBox="0 0 40 40"
	fill="none"
	stroke="currentColor"
	aria-hidden="true"
>
	{#if variant === 'plus'}
		<path d="M9 2v14M2 9h14" stroke-width="2.5" stroke-linecap="square" />
	{:else if variant === 'bold'}
		<path d="M9 1v16M1 9h16" stroke-width="4.5" />
	{:else if variant === 'ring'}
		<circle cx="9" cy="9" r="8" stroke-width="1.75" class="fill-surface" />
		<path d="M9 4.5v9M4.5 9h9" stroke-width="2.5" stroke-linecap="round" />
	{:else if variant === 'diamond'}
		<path d="M9 0.75 17.25 9 9 17.25 0.75 9Z" stroke-width="1.75" class="fill-surface" />
		<path d="M9 5.25v7.5M5.25 9h7.5" stroke-width="2.5" stroke-linecap="round" />
	{:else if variant === 'bracket'}
		<path d="M9 2v14M2 9h14" stroke-width="3" stroke-linecap="square" />
		<path d="M19 9h17M9 19v17" stroke-width="2.5" stroke-linecap="round" />
	{/if}
</svg>
