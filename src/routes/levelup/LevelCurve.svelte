<!--
	레벨 추이 그래프. 차트 라이브러리 없이 SVG로 그린다 (선 하나 + 목표선).
	세로축은 레벨 + 레벨 안 진행률이라, 레벨업 보너스로 빨라지는 구간이 기울기로 보인다.
-->
<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import type { CurvePoint } from '$lib/calc/levelup-adapter';
	import { formatDate, formatInt } from '$lib/format';
	import { addDays } from '$lib/game-date';
	import { ChartCursor } from '$lib/chart-cursor.svelte';
	import ChartCursorMark from '$lib/components/ChartCursor.svelte';

	interface Props {
		points: CurvePoint[];
		/** 목표 레벨 모드일 때 가로 점선 */
		target: number | null;
		/** 계산 기준일 (0일째). 커서에 날짜를 보여줄 때 쓴다 */
		today: string;
	}

	let { points, target, today }: Props = $props();

	const W = 320;
	const H = 180;
	const PAD = { left: 40, right: 12, top: 12, bottom: 24 };
	/** 점이 많으면 이 수 안팎으로 줄인다 (마지막 점은 항상 남김) */
	const MAX_POINTS = 360;

	const sampled = $derived.by(() => {
		if (points.length <= MAX_POINTS) return points;
		const step = Math.ceil(points.length / MAX_POINTS);
		const out = points.filter((_, i) => i % step === 0);
		if (out.at(-1) !== points.at(-1)) out.push(points[points.length - 1]);
		return out;
	});

	const lastDay = $derived(points[points.length - 1].day);
	const fromLevel = $derived(Math.floor(points[0].level));
	const toLevel = $derived(Math.floor(points[points.length - 1].level));
	const yMin = $derived(fromLevel);
	const yMax = $derived(
		Math.max(Math.ceil(points[points.length - 1].level), target ?? 0, yMin + 1)
	);

	const x = (day: number) => PAD.left + (day / Math.max(lastDay, 1)) * (W - PAD.left - PAD.right);
	const y = (level: number) =>
		PAD.top + (1 - (level - yMin) / (yMax - yMin)) * (H - PAD.top - PAD.bottom);

	// ---------------------------------------------------------------- 커서 (2026-10-01)
	// 데스크톱은 마우스로 훑고, 모바일은 손가락으로 끌면 그 날의 레벨과 날짜를 보여준다

	const cursor = new ChartCursor(
		() => points.map((p) => p.day),
		(vx) => ((vx - PAD.left) / (W - PAD.left - PAD.right)) * lastDay,
		W,
		'levelup'
	);
	const cursorPoint = $derived(cursor.index === null ? null : (points[cursor.index] ?? null));
	const cursorLines = $derived(
		cursorPoint
			? [
					m.levelup_curve_cursor({ level: String(Math.floor(cursorPoint.level)) }),
					formatDate(addDays(today, cursorPoint.day)),
					cursorPoint.day === 0
						? m.chart_today()
						: m.chart_after_days({ days: m.unit_days({ count: formatInt(cursorPoint.day) }) })
				]
			: null
	);
	const cursorText = $derived(cursorLines?.join(', ') ?? null);
	const summary = $derived(
		`${m.levelup_curve_summary({
			days: m.unit_days({ count: formatInt(lastDay) }),
			from: String(fromLevel),
			to: String(toLevel)
		})}. ${m.chart_hint()}`
	);

	const path = $derived(
		sampled.map((p) => `${x(p.day).toFixed(1)},${y(p.level).toFixed(1)}`).join(' ')
	);
</script>

<svg
	viewBox="0 0 {W} {H}"
	class="w-full touch-pan-y outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-strong"
	role="slider"
	tabindex="0"
	aria-valuemin={0}
	aria-valuemax={lastDay}
	aria-valuenow={cursorPoint?.day ?? 0}
	aria-valuetext={cursorText ?? summary}
	aria-label={summary}
	onpointerdown={cursor.onpointerdown}
	onpointermove={cursor.onpointermove}
	onpointerleave={cursor.onpointerleave}
	onkeydown={cursor.onkeydown}
	onblur={cursor.onblur}
>
	<!-- 축 -->
	<line
		x1={PAD.left}
		y1={H - PAD.bottom}
		x2={W - PAD.right}
		y2={H - PAD.bottom}
		class="stroke-navy/60"
	/>
	<line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={H - PAD.bottom} class="stroke-navy/60" />

	<!-- 세로축 눈금: 시작·끝 레벨 -->
	<text
		x={PAD.left - 6}
		y={y(yMin)}
		text-anchor="end"
		dominant-baseline="middle"
		class="fill-navy text-[10px]"
	>
		Lv.{yMin}
	</text>
	<text
		x={PAD.left - 6}
		y={y(yMax)}
		text-anchor="end"
		dominant-baseline="middle"
		class="fill-navy text-[10px]"
	>
		Lv.{yMax}
	</text>

	<!-- 가로축 눈금: 0일·마지막 날 -->
	<text x={x(0)} y={H - 6} text-anchor="start" class="fill-navy text-[10px]">
		{m.unit_days({ count: '0' })}
	</text>
	<text x={x(lastDay)} y={H - 6} text-anchor="end" class="fill-navy text-[10px] tabular-nums">
		{m.unit_days({ count: formatInt(lastDay) })}
	</text>

	<!-- 목표선 -->
	{#if target !== null}
		<line
			x1={PAD.left}
			y1={y(target)}
			x2={W - PAD.right}
			y2={y(target)}
			stroke-dasharray="4 3"
			class="stroke-navy"
		/>
		<text x={W - PAD.right} y={y(target) - 4} text-anchor="end" class="fill-navy text-[10px]">
			{m.levelup_curve_target({ level: String(target) })}
		</text>
	{/if}

	<!-- 레벨 곡선 (그래프 주 계열 = brand, 디자인 문서 2-3) -->
	<polyline
		points={path}
		fill="none"
		stroke-width="2"
		stroke-linejoin="round"
		stroke-linecap="round"
		class="stroke-brand"
	/>

	{#if cursorPoint && cursorLines}
		<ChartCursorMark
			x={x(cursorPoint.day)}
			y={y(cursorPoint.level)}
			top={PAD.top}
			bottom={H - PAD.bottom}
			width={W}
			lines={cursorLines}
		/>
	{/if}
</svg>
