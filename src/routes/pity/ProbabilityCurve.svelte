<!--
	연차별 획득 확률 곡선. 가로축은 0 ~ 천장.
	천장에서 100%로 수직으로 뛰는 선이 포인트 방식을 보여주는 핵심이다.
	보유분을 넘는 구간은 점선 + 음영.

	라이브러리 없이 SVG로 그린다. 표시 요소가 세 개(보유·천장·축)뿐이라
	차트 라이브러리의 주석 플러그인보다 직접 그리는 편이 단순하다.

	눈금과 격자 (디자인 문서 5-12, 2026-09-30): 세로 0·25·50·75·100%, 가로 50연 간격 + 끝(천장).
	격자는 옅게(navy/15) — 읽기를 돕는 선이라 데이터층에 둬도 장식이 아니다.

	모집 스택 (2026-10-23): 반천장(halfAt)에서 곡선이 한 번 뛴다. 그 자리에 옅은 점선과 "반천장" 글자를 둔다.
	곡선 자체의 계단은 계산이 만든 점(반천장-1, 반천장)이 그린다 — 여기서 따로 그리지 않는다.

	움직임 (2026-10-23, 8-2 F2): 값이 바뀌면 곡선이 새 모양으로 옮겨 간다 (curve-morph.svelte.ts).
	천장의 수직선은 곡선 끝에 이어 붙여 함께 옮기고, 보유 연차 표시선·음영도 같은 박자로 옮긴다.
	반천장 점선·눈금 글자는 바로 바뀐다. 다른 화면에서 옮겨 와 나타날 때는 곡선이 왼쪽부터 그려진다
-->
<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import type { CurvePoint } from '$lib/calc/gacha';
	import { formatInt } from '$lib/format';
	import { CurveMorph, ValueMorph, type Pt } from '$lib/curve-morph.svelte';
	import { isClientArrival, reducedMotion } from '$lib/motion';

	interface Props {
		curve: CurvePoint[];
		pullsToPity: number;
		availablePulls: number;
		/** 반천장까지의 연차 (스택 방식, 반천장이 아직 앞에 있을 때만) */
		halfAt?: number;
	}

	let { curve, pullsToPity, availablePulls, halfAt }: Props = $props();

	const W = 320;
	const H = 180;
	const pad = { l: 36, r: 12, t: 18, b: 28 };

	const x = (n: number) => pad.l + (n / pullsToPity) * (W - pad.l - pad.r);
	const y = (p: number) => pad.t + (1 - p) * (H - pad.t - pad.b);

	const short = $derived(availablePulls < pullsToPity);
	const inRange = $derived(curve.filter((c) => c.pulls <= pullsToPity));
	const owned = $derived(inRange.filter((c) => c.pulls <= availablePulls));
	const beyond = $derived(inRange.filter((c) => c.pulls >= availablePulls));
	const atPity = $derived(inRange.at(-1)?.probability ?? 0);

	const Y_TICKS = [0, 0.25, 0.5, 0.75, 1];
	const X_STEP = 50;
	/** 끝 눈금(천장)과 너무 가까운 중간 눈금은 글자만 뺀다 (선은 그린다) */
	// 끝 눈금은 오른쪽 정렬("170연")이라 글자 폭만큼 왼쪽으로 뻗는다 → 28에서 42로 (2026-10-23, 150·170연이 겹쳤다)
	const LABEL_GAP = 42;
	const xTicks = $derived(
		Array.from({ length: Math.floor((pullsToPity - 1) / X_STEP) }, (_, i) => (i + 1) * X_STEP)
	);

	const toPts = (cs: CurvePoint[]): Pt[] => cs.map((c) => [x(c.pulls), y(c.probability)]);
	/** 천장에서 100%로 뛰는 수직선: 마지막 선(보유분을 넘으면 점선 쪽) 끝에 이어 붙인다 */
	const pityRise = $derived<Pt[]>([
		[x(pullsToPity), y(atPity)],
		[x(pullsToPity), y(1)]
	]);
	const ownedLine = $derived<Pt[]>(short ? toPts(owned) : [...toPts(owned), ...pityRise]);
	const beyondLine = $derived<Pt[]>(short ? [...toPts(beyond), ...pityRise] : []);

	const ownedMorph = new CurveMorph(() => ownedLine);
	const beyondMorph = new CurveMorph(() => beyondLine);
	const budgetX = new ValueMorph(() => x(availablePulls));
	/*
	 * "보유 N연" 글자는 표시선 왼쪽에 둔다. 다만 표시선이 세로축에 가까우면(보유 연차가 적으면) 왼쪽 눈금 글자(100% 등)와
	 * 겹치므로 오른쪽으로 옮긴다 (2026-10-24). 글자 폭은 한글 세 자 + 숫자 자릿수로 어림한다 (11px: 한글 약 11, 숫자 약 6.4).
	 * 어느 쪽에 둘지는 옮겨 가는 중의 위치가 아니라 최종 위치로 정한다 — 움직이는 동안 좌우로 튀지 않게
	 */
	const budgetLabelWidth = $derived(36 + String(availablePulls).length * 6.5);
	const budgetLabelRight = $derived(x(availablePulls) - pad.l < budgetLabelWidth + 6);

	/** 다른 화면에서 옮겨 와 나타날 때만 곡선이 그려진다 (처음 들어온 화면은 서버가 그린 그대로) */
	const drawIn = isClientArrival() && !reducedMotion();
</script>

<svg viewBox="0 0 {W} {H}" class="w-full font-num" role="img" aria-label={m.pity_curve_title()}>
	{#if short}
		<rect
			x={budgetX.current}
			y={pad.t}
			width={Math.max(0, x(pullsToPity) - budgetX.current)}
			height={H - pad.t - pad.b}
			class="fill-navy/5"
		/>
	{/if}

	<!-- 격자 -->
	{#each Y_TICKS.slice(1) as p (p)}
		<line x1={pad.l} y1={y(p)} x2={W - pad.r} y2={y(p)} class="stroke-navy/15" />
	{/each}
	{#each xTicks as n (n)}
		<line x1={x(n)} y1={pad.t} x2={x(n)} y2={y(0)} class="stroke-navy/15" />
	{/each}
	<line x1={pad.l} y1={pad.t} x2={pad.l} y2={y(0)} class="stroke-navy/40" />
	<line x1={pad.l} y1={y(0)} x2={W - pad.r} y2={y(0)} class="stroke-navy/40" />

	{#if halfAt !== undefined && halfAt < pullsToPity}
		<line
			x1={x(halfAt)}
			y1={pad.t}
			x2={x(halfAt)}
			y2={y(0)}
			class="stroke-navy/40"
			stroke-dasharray="2 3"
		/>
		<text x={x(halfAt) + 4} y={y(0) - 6} text-anchor="start" class="fill-navy text-[11px]">
			{m.pity_curve_half()}
		</text>
	{/if}

	<g class={drawIn ? 'curve-draw' : undefined}>
		<polyline points={ownedMorph.points} fill="none" class="stroke-brand" stroke-width="2" />
		{#if short}
			<polyline
				points={beyondMorph.points}
				fill="none"
				class="stroke-brand"
				stroke-width="2"
				stroke-dasharray="4 3"
			/>
		{/if}
	</g>

	{#if short && availablePulls > 0}
		<line x1={budgetX.current} y1={pad.t} x2={budgetX.current} y2={y(0)} class="stroke-ink" />
		<text
			x={budgetLabelRight ? budgetX.current + 4 : budgetX.current - 4}
			y={pad.t + 10}
			text-anchor={budgetLabelRight ? 'start' : 'end'}
			class="fill-ink text-[11px]"
		>
			{m.pity_curve_budget({ count: formatInt(availablePulls) })}
		</text>
	{/if}
	<text x={x(pullsToPity) - 4} y={pad.t - 4} text-anchor="end" class="fill-ink text-[11px]">
		{m.pity_curve_pity({ count: formatInt(pullsToPity) })}
	</text>

	<!-- 눈금 글자 -->
	{#each Y_TICKS as p (p)}
		<text x={pad.l - 6} y={y(p) + 4} text-anchor="end" class="fill-navy text-[11px]">
			{p * 100}%
		</text>
	{/each}
	<text x={pad.l} y={H - 8} text-anchor="middle" class="fill-navy text-[11px]">0</text>
	{#each xTicks as n (n)}
		{#if x(pullsToPity) - x(n) >= LABEL_GAP}
			<text x={x(n)} y={H - 8} text-anchor="middle" class="fill-navy text-[11px]">
				{formatInt(n)}
			</text>
		{/if}
	{/each}
	<text x={W - pad.r} y={H - 8} text-anchor="end" class="fill-navy text-[11px]">
		{m.unit_pulls({ count: formatInt(pullsToPity) })}
	</text>
</svg>
