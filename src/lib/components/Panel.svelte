<!--
	패널층 (디자인 문서 5-2). 계산기의 모든 덩어리는 이 안에 놓인다.

	공간 문법 (2026-10-23, 5-19) — 판은 배경 위에 떠 있다. 높이가 곧 중요도.
	- e1 (기본): 입력판·그래프판. 92% 흰 판(블러 없음) + 흰 테두리 + 위쪽 1px 하이라이트 + 파란 그림자
	- e2: 결과판. 더 높이 뜨고, 판정 색(tone)을 입는다
	    secured   위가 옅은 파랑 (secured 8%) + 하늘빛 번짐
	    shortfall 위가 옅은 주황 (shortfall 12%) + 주황 번짐
	    neutral   색 없음 + 하늘빛 번짐 — 판정이 없는 결과 (매핑: 디자인 문서 5-18)
	  대비 한계 (5-18): 주황은 12%를 넘기면 그 위 shortfall-strong 글자가, 파랑은 5%를 넘기면 작은 secured 글자가
	  4.5:1 아래로 내려간다 → 그라데이션은 위쪽만 진하고 절반쯤에서 사라진다. 작은 의미 색 글자는 판 아래쪽에 둔다
	- 제목(title)은 판 위쪽 가장자리에 걸친 기울인 탭 (navy 면, 흰 글자 10.35:1). 탭이 판 위로 14px 솟으므로
	  판 사이 간격은 24px 이상 둔다 (계산기 화면의 gap-6)

	결과판의 반응 (2026-10-23, 8-2 F) — pulse에 결과를 넘기면:
	- 결과가 바뀌고 입력이 180ms 멈추면 빛줄 하나가 판 위에서 아래로 한 번 훑는다 (280ms, 글자 뒤로 지나간다)
	- 그때 판정 색(tone)까지 바뀌었으면 모서리 + 표식이 한 번 튄다 (200ms)
	- 다른 화면에서 옮겨 와 결과판이 나타날 때도 빛줄이 한 번 지나간다. 처음 들어온 화면은 조용히
	- 줄인 움직임 설정이면 아무것도 하지 않는다. 판 색은 움직임 없이 바로 바뀐다

	모서리 + 표식은 결과 패널에만 (marks). "답이 있는 곳"을 표시하는 장치 (2026-10-01, A안).
	표식 색은 판정 색을 따른다 (부족이면 주황). 표식 모양은 CornerMark.svelte.
	판 안에는 진한 선을 두지 않는다 — 구역은 여백과 옅은 바탕으로 나눈다.
	모양을 바꿀 때는 이 파일만 고친다.
-->
<script lang="ts" module>
	export type PanelTone = 'neutral' | 'secured' | 'shortfall';
</script>

<script lang="ts">
	import { onDestroy, untrack, type Snippet } from 'svelte';
	import { MOTION, isClientArrival, reducedMotion } from '$lib/motion';
	import CornerMark, { type Corner } from './CornerMark.svelte';

	interface Props {
		/** 판 위쪽 가장자리의 탭 제목. 없으면 탭 없이 */
		title?: string;
		/** true면 네 모서리에 + 표식 (결과 패널) */
		marks?: boolean;
		/** 높이 단계. 결과판만 e2 */
		elevation?: 'e1' | 'e2';
		/** e2 결과판의 판정 색 */
		tone?: PanelTone;
		/** 배치용 클래스 (예: 칸 높이에 맞춰 늘이기 xl:flex-1) */
		class?: string;
		/** e2 결과판: 결과 값. 바뀌면 빛줄·표식 튐으로 알린다 */
		pulse?: unknown;
		children: Snippet;
	}

	let {
		title,
		marks = false,
		elevation = 'e1',
		tone = 'neutral',
		class: className = '',
		pulse,
		children
	}: Props = $props();

	const CORNERS: Corner[] = ['tl', 'tr', 'bl', 'br'];

	// Tailwind가 찾을 수 있도록 클래스 이름을 통째로 적는다 (조립하지 않는다)
	const SURFACE = {
		e1: 'bg-surface/92 shadow-e1',
		e2: 'bg-surface shadow-e2'
	} as const;
	const TINT: Record<PanelTone, string> = {
		neutral: '',
		secured: 'bg-linear-to-b from-secured/8 to-transparent to-55%',
		shortfall: 'bg-linear-to-b from-shortfall/12 to-transparent to-55%'
	};
	const GLOW: Record<PanelTone, string> = {
		neutral: 'shadow-glow-cyan',
		secured: 'shadow-glow-cyan',
		shortfall: 'shadow-glow-shortfall'
	};

	const raised = $derived(elevation === 'e2');
	/** 색을 입힌 판: 안의 숫자 칸(Metric)이 wash 대신 흰색을 쓴다 (옅은 파랑 판과 wash는 1.01~1.08:1) */
	const tinted = $derived(raised && tone !== 'neutral');

	// 결과판의 반응: 빛줄(scanKey)과 표식 튐(popKey)은 숫자가 바뀔 때마다 다시 그려 재생한다
	let scanKey = $state(0);
	let popKey = $state(0);
	let lastSignal: string | undefined;
	let lastTone: PanelTone | undefined;
	let timer: ReturnType<typeof setTimeout> | undefined;

	$effect(() => {
		if (!raised || pulse === undefined) return;
		const signal = JSON.stringify(pulse);
		const nowTone = tone;
		untrack(() => {
			if (lastSignal === undefined) {
				// 처음 나타남: 다른 화면에서 옮겨 왔을 때만 한 번 훑는다
				lastSignal = signal;
				lastTone = nowTone;
				if (isClientArrival() && !reducedMotion()) {
					timer = setTimeout(() => (scanKey += 1), MOTION.arrival);
				}
				return;
			}
			if (signal === lastSignal) return;
			lastSignal = signal;
			clearTimeout(timer);
			timer = setTimeout(() => {
				const toneChanged = nowTone !== lastTone;
				lastTone = nowTone;
				if (reducedMotion()) return;
				scanKey += 1;
				if (toneChanged) popKey += 1;
			}, MOTION.settle);
		});
	});

	onDestroy(() => clearTimeout(timer));
</script>

<section
	data-tinted={tinted || undefined}
	class="group/plate relative isolate rounded-xl border border-white p-4 md:p-6 {SURFACE[
		elevation
	]} {raised ? TINT[tone] : ''} {title ? 'pt-8 md:pt-9' : ''} {className}"
>
	{#if raised}
		<!-- 판정 색 번짐: 판 바로 뒤의 얇은 층. 바깥 그림자라 판 안쪽은 덮지 않는다 -->
		<div
			aria-hidden="true"
			class="pointer-events-none absolute -inset-px rounded-xl {GLOW[tone]} forced-colors:hidden"
		></div>
	{/if}
	{#if raised && scanKey > 0}
		{#key scanKey}
			<!-- 빛줄: 판 바탕 위, 글자 뒤 (isolate 안의 -z-10) -->
			<div
				aria-hidden="true"
				class="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-xl forced-colors:hidden"
			>
				<div class="plate-scan absolute inset-0"></div>
			</div>
		{/key}
	{/if}
	{#if marks}
		{#key popKey}
			{#each CORNERS as corner (corner)}
				<CornerMark {corner} tone={raised ? tone : 'neutral'} pop={popKey > 0} />
			{/each}
		{/key}
	{/if}
	{#if title}
		<h2
			class="absolute -top-3.5 left-5 h-7 -skew-x-30 rounded-[3px_8px] bg-navy px-4 text-[0.8125rem] leading-7 font-bold text-white shadow-[0_6px_14px_-6px_rgb(42_66_91/0.6)]"
		>
			<span class="inline-block skew-x-30">{title}</span>
		</h2>
	{/if}
	{@render children()}
</section>
