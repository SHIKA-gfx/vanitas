<!--
	그래프 커서 그림 (SVG 안에 넣는다): 세로 점선 + 점 + 값 상자.
	값 상자는 커서 오른쪽에 두고, 그래프 오른쪽 끝에 가까우면 왼쪽으로 넘긴다.
	첫 줄은 값(굵게), 다음 줄들은 날짜 정보.
-->
<svelte:options namespace="svg" />

<script lang="ts">
	interface Props {
		x: number;
		y: number;
		/** 세로 점선이 그려지는 위·아래 (viewBox 좌표) */
		top: number;
		bottom: number;
		/** viewBox 너비 — 상자가 넘치지 않게 */
		width: number;
		lines: string[];
		/** 첫 줄(값) 글자색 클래스 */
		valueClass?: string;
	}

	let { x, y, top, bottom, width, lines, valueClass = 'fill-ink' }: Props = $props();

	const FONT = 10;
	const LINE = 13;
	const PAD = 6;

	/** 글자 폭 어림: 한글·전각 1em, 그 밖 0.6em */
	const textWidth = (s: string) =>
		[...s].reduce((w, ch) => w + (/[\u3131-\uD7A3]/.test(ch) ? FONT : FONT * 0.6), 0);

	const boxW = $derived(Math.max(...lines.map(textWidth)) + PAD * 2);
	const boxH = $derived(lines.length * LINE + PAD * 2 - 3);
	const boxX = $derived(x + 8 + boxW <= width - 2 ? x + 8 : x - 8 - boxW);
	const boxY = $derived(top + 2);
</script>

<line x1={x} x2={x} y1={top} y2={bottom} stroke-dasharray="3 3" class="stroke-navy/50" />
<circle cx={x} cy={y} r="4" stroke-width="2" class="fill-brand stroke-surface" />
<rect x={boxX} y={boxY} width={boxW} height={boxH} rx="4" class="fill-surface stroke-navy/15" />
{#each lines as text, i (i)}
	<text
		x={boxX + PAD}
		y={boxY + PAD + FONT + i * LINE - 1}
		class="text-[10px] {i === 0 ? `font-bold ${valueClass}` : 'fill-navy'}"
	>
		{text}
	</text>
{/each}
