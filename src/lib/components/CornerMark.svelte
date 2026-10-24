<!--
	결과 패널 네 모서리의 + 표식 (디자인 문서 5-2). Panel이 marks일 때 그린다.
	"답이 있는 곳"을 표시하는 장치라 결과 패널에만 붙는다.

	모양 (2026-10-01): 굵은 십자, 16px · 선 4.5px · brand.
	가는 십자·원·마름모·모서리 선 시안을 스타일 타일에서 비교한 뒤, 두께만 키운 이 모양으로 정했다.
	표식 중심이 패널 모서리에 오도록 놓고, 오른쪽·아래 모서리는 거울처럼 뒤집는다.
	색은 결과판의 판정 색을 따른다 (2026-10-23, 5-18): 부족이면 shortfall, 그 밖에는 brand. 장식이라 글자 대비 기준은 없다
-->
<script lang="ts" module>
	export type Corner = 'tl' | 'tr' | 'bl' | 'br';
</script>

<script lang="ts">
	import type { PanelTone } from './Panel.svelte';

	let { corner, tone = 'neutral' }: { corner: Corner; tone?: PanelTone } = $props();

	const COLOR: Record<PanelTone, string> = {
		neutral: 'text-brand',
		secured: 'text-brand',
		shortfall: 'text-shortfall'
	};

	/** 표식 중심(9,9)이 패널 모서리에 오도록 9px 바깥에 놓는다 */
	const POSITION: Record<Corner, string> = {
		tl: '-top-[9px] -left-[9px]',
		tr: '-top-[9px] -right-[9px] -scale-x-100',
		bl: '-bottom-[9px] -left-[9px] -scale-y-100',
		br: '-bottom-[9px] -right-[9px] -scale-100'
	};
</script>

<svg
	class="pointer-events-none absolute size-[18px] {COLOR[tone]} {POSITION[corner]}"
	viewBox="0 0 18 18"
	fill="none"
	stroke="currentColor"
	aria-hidden="true"
>
	<path d="M9 1v16M1 9h16" stroke-width="4.5" />
</svg>
