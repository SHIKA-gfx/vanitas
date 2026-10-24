<!--
	싯딤의 상자 배경 (디자인 문서 5-19, 2026-10-23). 홈·계산기·정보·오류 화면이 모두 이 배경 하나를 쓴다.
	뒤에서부터 네 층:
	  1 화면 바탕  위가 진한 하늘색 세로 그라데이션 + 왼쪽 아래 blush 기운 + 가운데 흰 빛
	  2 격자       흰 선 48px(모바일 40px), 세 칸마다 + 표식
	  3 삼각형     한 변 96px(모바일 64px) 정삼각형 격자 위에만. 화면 모서리에 붙여 가운데(판이 놓이는 곳)는 비운다
	  4 바닥       원근 격자 rotateX(60°) + 지평선 빛. 화면 아래 300px(모바일 190px)

	- 정보를 담지 않는 배경층이다. 위에 바로 글자를 놓을 때는 ink·navy만 (brand-strong은 어디서든 4.5:1 미달)
	- 화면에 고정되어 판만 그 위로 스크롤된다. iOS 사파리는 background-attachment: fixed를 무시하므로 고정 요소로 그린다
	- 원본 화면의 구도를 따라 그리지 않는다. 격자·+·정삼각형·원근 바닥이라는 도형 문법만 가져와 배치는 새로 했다
	- 움직이지 않는다. 화면 전환 때 층별로 밀리는 시차는 8-2 E단계에서 더한다
	- 고대비(강제 색상) 모드에서는 통째로 숨긴다 — 배경 이미지·그림자가 사라지는 모드라 남겨도 의미가 없다
-->
<script lang="ts">
	interface Props {
		/** 기본은 화면에 고정. 스타일 타일처럼 상자 안에 미리 볼 때 'absolute' */
		position?: 'fixed' | 'absolute';
	}
	let { position = 'fixed' }: Props = $props();
	const positionClass = $derived(position === 'fixed' ? 'fixed' : 'absolute');

	/** 삼각형 격자: 한 변 96, 높이 96·√3/2. 모바일은 묶음 전체를 2/3로 줄인다 (CSS --k) */
	const SIDE = 96;
	const H = (SIDE * Math.sqrt(3)) / 2;

	type Tone = 'white' | 'sky' | 'muted';
	/** [열, 줄, 색, 불투명도, 크기 배수]. 열은 반 변(48) 단위, (열 + 줄)이 짝수면 위를 향한다 */
	type Cell = [number, number, Tone, number, number?];

	const FILL: Record<Tone, string> = {
		white: '#ffffff',
		sky: 'var(--color-sky)',
		muted: 'var(--color-sky-muted)'
	};

	function points([col, row, , , k = 1]: Cell): string {
		const s = SIDE * k;
		const h = H * k;
		const x = (col * s) / 2;
		const y0 = row * h;
		const y1 = y0 + h;
		const up = (col + row) % 2 === 0;
		const pts = up
			? [
					[x, y1],
					[x + s / 2, y0],
					[x + s, y1]
				]
			: [
					[x, y0],
					[x + s, y0],
					[x + s / 2, y1]
				];
		return pts.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' ');
	}

	/** 묶음 하나 = 모서리에 붙는 SVG 하나. 폭·높이는 격자 단위로 정해 두고 화면 폭이 바뀌어도 모서리를 지킨다 */
	interface Cluster {
		key: string;
		/** 붙는 자리 (Tailwind 클래스) */
		place: string;
		width: number;
		height: number;
		cells: Cell[];
	}

	const CLUSTERS: Cluster[] = [
		{
			key: 'top-right',
			place: 'top-0 right-0',
			width: SIDE * 4,
			height: Math.ceil(H * 4),
			cells: [
				[6, 0, 'white', 0.55],
				[7, 0, 'sky', 0.35],
				[5, 1, 'white', 0.4],
				[4, 0, 'muted', 0.3],
				[6, 1, 'sky', 0.28],
				[3, 1, 'white', 0.5],
				[7, 1, 'white', 0.3],
				[5, 2, 'sky', 0.3],
				[2, 0, 'white', 0.35],
				[2, 1, 'white', 0.22, 2]
			]
		},
		{
			key: 'left',
			place: 'top-[42%] left-0',
			width: SIDE * 2,
			height: Math.ceil(H * 3),
			cells: [
				[0, 0, 'white', 0.45],
				[1, 0, 'sky', 0.3],
				[0, 1, 'white', 0.25],
				[1, 1, 'white', 0.5],
				[2, 1, 'sky', 0.25],
				[0, 2, 'muted', 0.35]
			]
		},
		{
			// 지평선 바로 위. 모바일에서는 뺀다 (삼각형 절반, 5-19)
			key: 'bottom-right',
			place: 'right-0 bottom-[300px] hidden md:block',
			width: Math.round(SIDE * 3.5),
			height: Math.ceil(H * 2),
			cells: [
				[2, 0, 'white', 0.4],
				[3, 0, 'sky', 0.3],
				[1, 1, 'muted', 0.28],
				[4, 1, 'white', 0.45],
				[5, 1, 'sky', 0.3]
			]
		}
	];
</script>

<div
	aria-hidden="true"
	class="pointer-events-none inset-0 -z-10 overflow-hidden [contain:strict] forced-colors:hidden {positionClass}"
>
	<div class="layer-screen absolute inset-0"></div>
	<div class="layer-lattice absolute inset-0"></div>

	{#each CLUSTERS as c (c.key)}
		<svg
			class="cluster absolute {c.place}"
			style:--w="{c.width}px"
			style:--h="{c.height}px"
			viewBox="0 0 {c.width} {c.height}"
		>
			{#each c.cells as cell, i (i)}
				<polygon points={points(cell)} fill={FILL[cell[2]]} fill-opacity={cell[3]} />
			{/each}
		</svg>
	{/each}

	<div class="floor absolute inset-x-0 bottom-0">
		<div class="plane"></div>
		<div class="horizon"></div>
	</div>
</div>

<style>
	/* 1 화면 바탕 */
	.layer-screen {
		background:
			radial-gradient(
				70% 30% at 0% 100%,
				color-mix(in srgb, var(--color-blush) 50%, transparent),
				transparent
			),
			linear-gradient(
				180deg,
				var(--color-screen-top) 0%,
				color-mix(in srgb, var(--color-screen-top), var(--color-screen-mid)) 22%,
				var(--color-screen-mid) 58%,
				var(--color-screen-low) 100%
			);
	}
	@media (min-width: 48rem) {
		.layer-screen {
			background:
				radial-gradient(
					44% 40% at 3% 100%,
					color-mix(in srgb, var(--color-blush) 55%, transparent),
					transparent
				),
				radial-gradient(40% 36% at 64% 30%, rgb(255 255 255 / 0.75), transparent),
				linear-gradient(
					180deg,
					var(--color-screen-top) 0%,
					color-mix(in srgb, var(--color-screen-top), var(--color-screen-mid)) 34%,
					var(--color-screen-mid) 60%,
					var(--color-screen-low) 100%
				);
		}
	}

	/*
	 * 2 격자 + 표식. + 무늬 한 장은 세 칸이고 + 가 한가운데 있다 → 한 칸 반만큼 당겨 교차점에 맞춘다.
	 * + 의 중심을 선 두께(1px)의 가운데에 두려고 60.5에 그린다 (120 단위 기준)
	 */
	.layer-lattice {
		--cell: 40px;
		background-image:
			url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'%3E%3Cpath d='M60.5 54V67M54 60.5H67' fill='none' stroke='white' stroke-opacity='0.95' stroke-width='1.5'/%3E%3C/svg%3E"),
			linear-gradient(rgb(255 255 255 / 0.55) 1px, transparent 1px),
			linear-gradient(90deg, rgb(255 255 255 / 0.55) 1px, transparent 1px);
		background-size:
			calc(var(--cell) * 3) calc(var(--cell) * 3),
			var(--cell) var(--cell),
			var(--cell) var(--cell);
		background-position:
			calc(var(--cell) * -1.5) calc(var(--cell) * -1.5),
			0 0,
			0 0;
	}
	@media (min-width: 48rem) {
		.layer-lattice {
			--cell: 48px;
		}
	}

	/* 3 삼각형 — 모바일은 2/3 크기 */
	.cluster {
		--k: 0.667;
		width: calc(var(--w) * var(--k));
		height: calc(var(--h) * var(--k));
	}
	@media (min-width: 48rem) {
		.cluster {
			--k: 1;
		}
	}

	/* 4 바닥: 위쪽(지평선)이 먼 쪽. 평면을 60° 눕히고, 먼 쪽 1/4은 마스크로 지운다 */
	.floor {
		height: 190px;
		perspective: 380px;
		perspective-origin: 50% 0%;
		background: linear-gradient(
			180deg,
			transparent,
			color-mix(in srgb, var(--color-sky) 32%, transparent)
		);
	}
	.plane {
		position: absolute;
		top: 0;
		left: -60%;
		width: 220%;
		height: 700px;
		transform-origin: 50% 0%;
		transform: rotateX(60deg);
		background-image:
			linear-gradient(rgb(255 255 255 / 0.9) 2px, transparent 2px),
			linear-gradient(90deg, rgb(255 255 255 / 0.9) 2px, transparent 2px);
		background-size: 56px 56px;
		-webkit-mask-image: linear-gradient(180deg, transparent 0%, #000 26%);
		mask-image: linear-gradient(180deg, transparent 0%, #000 26%);
	}
	.horizon {
		position: absolute;
		inset-inline: 0;
		top: 0;
		height: 1px;
		background: #fff;
		box-shadow: 0 0 14px 4px rgb(255 255 255 / 0.85);
	}
	@media (min-width: 48rem) {
		.floor {
			height: 300px;
			perspective: 560px;
		}
		.plane {
			left: -50%;
			width: 200%;
			height: 1000px;
			background-size: 72px 72px;
			-webkit-mask-image: linear-gradient(180deg, transparent 0%, #000 24%);
			mask-image: linear-gradient(180deg, transparent 0%, #000 24%);
		}
		.horizon {
			box-shadow: 0 0 18px 5px rgb(255 255 255 / 0.85);
		}
	}
</style>
