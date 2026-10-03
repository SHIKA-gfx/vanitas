<!--
	청휘석 잔고 추이. 차트 라이브러리 없이 SVG (레벨 추이와 같은 방식).
	잔고가 0 아래로 내려가면 0 기준선을 함께 그린다.
	마우스로 훑거나 손가락으로 끌면 그 날의 잔고와 날짜를 보여준다 (2026-10-01).
-->
<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import type { IncomeDay } from '$lib/calc/income';
	import { formatDate, formatInt } from '$lib/format';
	import { addDays } from '$lib/game-date';
	import { ChartCursor } from '$lib/chart-cursor.svelte';
	import ChartCursorMark from '$lib/components/ChartCursor.svelte';

	interface Props {
		records: IncomeDay[];
		/** 계산 기준일 (0일째). 커서에 날짜를 보여줄 때 쓴다 */
		today: string;
	}

	let { records, today }: Props = $props();

	const W = 320;
	const H = 180;
	const PAD = { left: 48, right: 12, top: 12, bottom: 24 };
	const MAX_POINTS = 360;

	const sampled = $derived.by(() => {
		if (records.length <= MAX_POINTS) return records;
		const step = Math.ceil(records.length / MAX_POINTS);
		const out = records.filter((_, i) => i % step === 0);
		if (out.at(-1) !== records.at(-1)) out.push(records[records.length - 1]);
		return out;
	});

	const first = $derived(records[0]);
	const last = $derived(records[records.length - 1]);
	const yMin = $derived(Math.min(0, ...records.map((r) => r.balance)));
	const yMax = $derived(Math.max(yMin + 1, ...records.map((r) => r.balance)));

	const x = (day: number) => PAD.left + (day / Math.max(last.day, 1)) * (W - PAD.left - PAD.right);
	const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * (H - PAD.top - PAD.bottom);

	const signed = (n: number) => (n < 0 ? `-${formatInt(-n)}` : formatInt(n));

	const cursor = new ChartCursor(
		() => records.map((r) => r.day),
		(vx) => ((vx - PAD.left) / (W - PAD.left - PAD.right)) * last.day,
		W,
		'income'
	);
	const cursorPoint = $derived(cursor.index === null ? null : (records[cursor.index] ?? null));
	const cursorLines = $derived(
		cursorPoint
			? [
					m.income_curve_cursor({ gems: signed(cursorPoint.balance) }),
					formatDate(addDays(today, cursorPoint.day)),
					cursorPoint.day === 0
						? m.chart_today()
						: m.chart_after_days({ days: m.unit_days({ count: formatInt(cursorPoint.day) }) })
				]
			: null
	);
	const cursorText = $derived(cursorLines?.join(', ') ?? null);
	const summary = $derived(
		`${m.income_curve_summary({
			days: m.unit_days({ count: formatInt(last.day) }),
			from: formatInt(first.balance),
			to: formatInt(last.balance)
		})}. ${m.chart_hint()}`
	);

	const path = $derived(
		sampled.map((r) => `${x(r.day).toFixed(1)},${y(r.balance).toFixed(1)}`).join(' ')
	);
</script>

<svg
	viewBox="0 0 {W} {H}"
	class="w-full touch-pan-y outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-strong"
	role="slider"
	tabindex="0"
	aria-valuemin={0}
	aria-valuemax={last.day}
	aria-valuenow={cursorPoint?.day ?? 0}
	aria-valuetext={cursorText ?? summary}
	aria-label={summary}
	onpointerdown={cursor.onpointerdown}
	onpointermove={cursor.onpointermove}
	onpointerleave={cursor.onpointerleave}
	onkeydown={cursor.onkeydown}
	onblur={cursor.onblur}
>
	<line
		x1={PAD.left}
		y1={H - PAD.bottom}
		x2={W - PAD.right}
		y2={H - PAD.bottom}
		class="stroke-navy/60"
	/>
	<line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={H - PAD.bottom} class="stroke-navy/60" />

	<text
		x={PAD.left - 6}
		y={y(yMin)}
		text-anchor="end"
		dominant-baseline="middle"
		class="fill-navy text-[10px]"
	>
		{formatInt(yMin)}
	</text>
	<text
		x={PAD.left - 6}
		y={y(yMax)}
		text-anchor="end"
		dominant-baseline="middle"
		class="fill-navy text-[10px]"
	>
		{formatInt(yMax)}
	</text>
	<text x={x(0)} y={H - 6} text-anchor="start" class="fill-navy text-[10px]">
		{m.unit_days({ count: '0' })}
	</text>
	<text x={x(last.day)} y={H - 6} text-anchor="end" class="fill-navy text-[10px] tabular-nums">
		{m.unit_days({ count: formatInt(last.day) })}
	</text>

	{#if yMin < 0}
		<line
			x1={PAD.left}
			y1={y(0)}
			x2={W - PAD.right}
			y2={y(0)}
			stroke-dasharray="4 3"
			class="stroke-navy"
		/>
	{/if}

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
			y={y(cursorPoint.balance)}
			top={PAD.top}
			bottom={H - PAD.bottom}
			width={W}
			lines={cursorLines}
			valueClass={cursorPoint.balance < 0 ? 'fill-blocked' : 'fill-ink'}
		/>
	{/if}
</svg>
