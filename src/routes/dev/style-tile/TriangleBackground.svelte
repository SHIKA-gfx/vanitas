<!--
	삼각형 타일 배경 (배경층 시안). 게임 UI 가장자리의 옅은 삼각형 무늬에서 느낌만 가져온다.
	sky와 채도를 뺀 sky 두 톤, 투명도를 낮게 두어 위에 놓인 패널(데이터층)을 방해하지 않게 한다.
	무늬 한 장 = 삼각형 COLS개 × ROWS줄. 같은 자리는 늘 같은 톤이 나오도록 의사난수로 고른다.
-->
<script lang="ts">
	interface Props {
		/** 삼각형 한 변 (px) */
		size?: number;
		/** 채도를 뺀 sky. 확정되면 토큰(sky-muted)으로 옮긴다 */
		muted?: string;
	}
	let { size = 64, muted = '#a3c5d8' }: Props = $props();

	const COLS = 12;
	const ROWS = 4;
	const id = $props.id();

	const h = $derived((size * Math.sqrt(3)) / 2);

	function tone(k: number, r: number): { fill: string; opacity: number } | null {
		const kk = ((k % COLS) + COLS) % COLS;
		const rr = ((r % ROWS) + ROWS) % ROWS;
		const n = Math.abs((kk * 73856093) ^ (rr * 19349663)) % 100;
		if (n < 52) return null;
		if (n < 72) return { fill: 'var(--color-sky)', opacity: 0.28 };
		if (n < 90) return { fill: muted, opacity: 0.35 };
		return { fill: 'var(--color-sky)', opacity: 0.5 };
	}

	const triangles = $derived.by(() => {
		const out: { points: string; fill: string; opacity: number }[] = [];
		for (let r = 0; r < ROWS; r++) {
			// 무늬 가장자리에 걸치는 삼각형도 그려야 이음새가 맞는다 (pattern이 바깥을 잘라준다)
			for (let k = -2; k <= COLS + 1; k++) {
				const t = tone(k, r);
				if (!t) continue;
				const x = (k * size) / 2;
				const y0 = r * h;
				const y1 = y0 + h;
				const up = (((k + r) % 2) + 2) % 2 === 0;
				const pts = up
					? [
							[x, y1],
							[x + size, y1],
							[x + size / 2, y0]
						]
					: [
							[x, y0],
							[x + size, y0],
							[x + size / 2, y1]
						];
				out.push({ points: pts.map((p) => p.join(',')).join(' '), ...t });
			}
		}
		return out;
	});
</script>

<svg class="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
	<defs>
		<pattern
			id="tri-{id}"
			width={(COLS * size) / 2}
			height={ROWS * h}
			patternUnits="userSpaceOnUse"
		>
			{#each triangles as t, i (i)}
				<polygon points={t.points} fill={t.fill} fill-opacity={t.opacity} />
			{/each}
		</pattern>
	</defs>
	<rect width="100%" height="100%" fill="url(#tri-{id})" />
</svg>
