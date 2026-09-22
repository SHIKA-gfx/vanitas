<!--
	연차별 획득 확률 곡선. 가로축은 0 ~ 천장.
	천장에서 100%로 수직으로 뛰는 선이 포인트 방식을 보여주는 핵심이다.
	보유분을 넘는 구간은 점선 + 음영.

	라이브러리 없이 SVG로 그린다. 표시 요소가 세 개(보유·천장·축)뿐이라
	차트 라이브러리의 주석 플러그인보다 직접 그리는 편이 단순하다.
-->
<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import type { CurvePoint } from '$lib/calc/gacha';
	import { formatInt } from '$lib/format';

	interface Props {
		curve: CurvePoint[];
		pullsToPity: number;
		availablePulls: number;
	}

	let { curve, pullsToPity, availablePulls }: Props = $props();

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

	const toPoints = (cs: CurvePoint[]) => cs.map((c) => `${x(c.pulls)},${y(c.probability)}`).join(' ');
</script>

<svg viewBox="0 0 {W} {H}" class="w-full" role="img" aria-label={m.pity_curve_title()}>
	{#if short}
		<rect
			x={x(availablePulls)}
			y={pad.t}
			width={x(pullsToPity) - x(availablePulls)}
			height={H - pad.t - pad.b}
			class="fill-navy/5"
		/>
	{/if}

	<line x1={pad.l} y1={y(0)} x2={W - pad.r} y2={y(0)} class="stroke-navy/40" />
	<line x1={pad.l} y1={y(0.5)} x2={W - pad.r} y2={y(0.5)} class="stroke-navy/20" stroke-dasharray="3 3" />
	<line x1={pad.l} y1={y(1)} x2={W - pad.r} y2={y(1)} class="stroke-navy/20" stroke-dasharray="3 3" />

	<polyline points={toPoints(owned)} fill="none" class="stroke-brand" stroke-width="2" />
	{#if short}
		<polyline points={toPoints(beyond)} fill="none" class="stroke-brand" stroke-width="2" stroke-dasharray="4 3" />
	{/if}
	<line
		x1={x(pullsToPity)}
		y1={y(atPity)}
		x2={x(pullsToPity)}
		y2={y(1)}
		class="stroke-brand"
		stroke-width="2"
		stroke-dasharray={short ? '4 3' : undefined}
	/>

	{#if short && availablePulls > 0}
		<line x1={x(availablePulls)} y1={pad.t} x2={x(availablePulls)} y2={y(0)} class="stroke-ink" />
		<text x={x(availablePulls) - 4} y={pad.t + 10} text-anchor="end" class="fill-ink text-[11px]">
			{m.pity_curve_budget({ count: formatInt(availablePulls) })}
		</text>
	{/if}
	<text x={x(pullsToPity) - 4} y={pad.t - 4} text-anchor="end" class="fill-ink text-[11px]">
		{m.pity_curve_pity({ count: formatInt(pullsToPity) })}
	</text>

	<text x={pad.l - 6} y={y(1) + 4} text-anchor="end" class="fill-navy text-[11px]">100%</text>
	<text x={pad.l - 6} y={y(0.5) + 4} text-anchor="end" class="fill-navy text-[11px]">50%</text>
	<text x={pad.l - 6} y={y(0) + 4} text-anchor="end" class="fill-navy text-[11px]">0%</text>
	<text x={pad.l} y={H - 8} class="fill-navy text-[11px]">0</text>
	<text x={W - pad.r} y={H - 8} text-anchor="end" class="fill-navy text-[11px]">
		{m.unit_pulls({ count: formatInt(pullsToPity) })}
	</text>
</svg>
