<!--
	홈 데스크톱 프레임 (디자인 문서 5-9).
	가운데 원(심볼 + 워드마크)을 네 타일이 둘러싸고, 원에 닿는 모서리는 원을 따라 곡선으로 파인다.

	타일은 기본 70% 흰색이라 뒤의 삼각형 배경이 비쳐 보이고, 마우스를 올리거나 키보드 초점이 오면
	완전한 흰색이 되어 "고른다"는 느낌을 준다 (2026-09-30 피드백). 준비 중(플래너)은 늘 70% + 점선.

	구조: SVG가 모양(원·타일·테두리)과 누르는 영역을 맡고, 그 위에 HTML이 글자를 얹는다.
	- 오목한 모서리는 border-radius나 CSS 마스크로는 테두리까지 따라가지 못한다 → SVG path
	- 타일의 <a>를 SVG 안에 두어, 누르는 영역과 키보드 초점 테두리가 곡선 모양을 그대로 따른다
	- 글자는 HTML(줄바꿈이 되니까)이고 누르는 건 SVG가 받으므로 pointer-events: none
-->
<script lang="ts">
	import type { Pathname } from '$app/types';
	import { resolve } from '$app/paths';
	import { localizeHref } from '$lib/paraglide/runtime';
	import type { SiteSection } from '$lib/nav';
	import NavIcon from '$lib/icons/NavIcon.svelte';
	import VanitasSymbol from '$lib/components/VanitasSymbol.svelte';
	import { m } from '$lib/paraglide/messages.js';

	interface Props {
		/** 화면 목록 (nav.ts 순서: 왼쪽 위 → 오른쪽 위 → 왼쪽 아래 → 오른쪽 아래) */
		sections: SiteSection[];
	}

	let { sections }: Props = $props();

	// 링크 주소는 이 파일 안에서 resolve()로 만든다. 함수를 속성으로 받으면
	// ESLint(svelte/no-navigation-without-resolve)가 resolve를 거쳤는지 알 수 없다
	const href = (path: string) => resolve(localizeHref(path) as Pathname);

	/**
	 * 기하 값은 여기 한 곳에서만 정한다 (디자인 문서 5-9).
	 * 파인 곡선의 반지름 = 원 반지름 + 틈 → 원과 타일 사이가 어디서나 같은 폭으로 벌어진다.
	 */
	const GEO = {
		/** SVG 좌표계 크기. 화면에서는 폭에 맞춰 늘고 준다 */
		width: 880,
		height: 520,
		/** 타일 사이 틈 = 원과 타일 사이 틈 */
		gap: 16,
		/** 가운데 원 반지름 */
		radius: 128,
		/** 타일 바깥 모서리 반경 */
		corner: 12,
		/** 테두리 굵기 */
		stroke: 1.5,
		/** 타일 안쪽 여백 (글자 자리) */
		pad: 28
	};

	const cx = GEO.width / 2;
	const cy = GEO.height / 2;
	const cut = GEO.radius + GEO.gap;
	const tileW = cx - GEO.gap / 2;
	const tileH = cy - GEO.gap / 2;

	/**
	 * 왼쪽 위 타일의 윤곽. 나머지 셋은 이 모양을 뒤집어 쓴다 (transform).
	 * 오른쪽 아래 모서리가 가운데 원(반지름 cut)을 따라 오목하게 파인다.
	 */
	function tilePath(): string {
		const r = GEO.corner;
		// 곡선이 타일의 오른쪽 변·아래쪽 변과 만나는 점
		const yOnRight = cy - Math.sqrt(cut ** 2 - (cx - tileW) ** 2);
		const xOnBottom = cx - Math.sqrt(cut ** 2 - (cy - tileH) ** 2);
		const h = GEO.stroke / 2; // 테두리가 잘리지 않게 반 굵기만큼 안쪽으로
		return [
			`M ${h + r} ${h}`,
			`H ${tileW - r}`,
			`A ${r} ${r} 0 0 1 ${tileW} ${h + r}`,
			`V ${yOnRight}`,
			// 오목한 곡선: 가운데 원의 중심을 기준으로 반시계 방향
			`A ${cut} ${cut} 0 0 0 ${xOnBottom} ${tileH}`,
			`H ${h + r}`,
			`A ${r} ${r} 0 0 1 ${h} ${tileH - r}`,
			`V ${h + r}`,
			`A ${r} ${r} 0 0 1 ${h + r} ${h}`,
			'Z'
		].join(' ');
	}

	const PATH = tilePath();

	/** 네 자리: 뒤집기, 글자 위치(%) */
	const SLOTS = [
		{ transform: '', box: 'left: 0; top: 0', align: 'items-start text-left justify-start' },
		{
			transform: `translate(${GEO.width} 0) scale(-1 1)`,
			box: 'right: 0; top: 0',
			align: 'items-end text-right justify-start'
		},
		{
			transform: `translate(0 ${GEO.height}) scale(1 -1)`,
			box: 'left: 0; bottom: 0',
			align: 'items-start text-left justify-end'
		},
		{
			transform: `translate(${GEO.width} ${GEO.height}) scale(-1 -1)`,
			box: 'right: 0; bottom: 0',
			align: 'items-end text-right justify-end'
		}
	];

	const pct = (v: number, of: number) => `${(v / of) * 100}%`;
	/** 글자 상자: 타일 크기에서 곡선 쪽 절반쯤을 비운다 */
	const textW = pct(tileW - GEO.radius * 0.9, GEO.width);
	const textH = pct(tileH - GEO.radius * 0.35, GEO.height);
	// CSS의 % 여백은 위아래도 부모의 '폭' 기준이라, 한 값으로 네 방향이 같은 여백이 된다
	const pad = pct(GEO.pad, GEO.width);
</script>

<div class="relative w-full" style="aspect-ratio: {GEO.width} / {GEO.height}">
	<svg viewBox="0 0 {GEO.width} {GEO.height}" class="absolute inset-0 h-full w-full">
		{#each sections.slice(0, 4) as section, i (section.path)}
			{@const slot = SLOTS[i]}
			{#if section.ready}
				<a
					href={href(section.path)}
					aria-label="{section.label()} — {section.description()}"
					class="group outline-none"
				>
					<path
						d={PATH}
						transform={slot.transform}
						stroke-width={GEO.stroke}
						class="fill-surface/70 stroke-navy/60 transition-colors group-hover:fill-surface group-focus-visible:fill-surface group-focus-visible:stroke-brand-strong group-focus-visible:[stroke-width:3]"
					/>
				</a>
			{:else}
				<path
					d={PATH}
					transform={slot.transform}
					stroke-width={GEO.stroke}
					stroke-dasharray="6 5"
					class="fill-surface/70 stroke-navy/60"
				/>
			{/if}
		{/each}
		<!-- 가운데 원: 면(솔리드). 타일은 선 — 면과 선으로 구역을 나눈다 -->
		<circle {cx} {cy} r={GEO.radius} class="fill-brand" />
	</svg>

	<!-- 글자층 (누르는 건 SVG가 받는다) -->
	{#each sections.slice(0, 4) as section, i (section.path)}
		{@const slot = SLOTS[i]}
		<div
			class="pointer-events-none absolute flex flex-col gap-1.5 {slot.align}"
			style="{slot.box}; width: {textW}; height: {textH}; padding: {pad}"
			aria-hidden="true"
		>
			<NavIcon
				name={section.icon}
				size={28}
				class={section.ready ? 'text-brand-strong' : 'text-navy/60'}
			/>
			<span class="text-xl font-bold {section.ready ? 'text-ink' : 'text-navy/60'}">
				{section.label()}
			</span>
			<span class="text-sm break-keep {section.ready ? 'text-navy' : 'text-navy/60'}">
				{section.description()}
			</span>
			{#if !section.ready}
				<span class="rounded border border-navy/60 px-1.5 text-xs text-navy">
					{m.nav_preparing()}
				</span>
			{/if}
		</div>
	{/each}

	<!-- 원 안: 심볼 + 워드마크 (워드마크 SVG 확정 전까지는 글자) -->
	<div
		class="pointer-events-none absolute flex flex-col items-center justify-center gap-1 text-white"
		style="left: {pct(cx - GEO.radius, GEO.width)}; top: {pct(
			cy - GEO.radius,
			GEO.height
		)}; width: {pct(GEO.radius * 2, GEO.width)}; height: {pct(GEO.radius * 2, GEO.height)}"
	>
		<VanitasSymbol class="w-[34%]" />
		<h1 class="font-display text-[1.75rem] font-bold tracking-wider">{m.app_title()}</h1>
	</div>
</div>
