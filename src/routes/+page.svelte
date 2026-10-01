<!--
	/ko — 홈 (디자인 문서 5-9).
	- 데스크톱(md 이상): 가운데 원 + 곡선으로 파인 네 타일 (HomeFrame)
	- 모바일: 맨 위 원(심볼) + 워드마크 띠, 그 아래 타일 1열
	배경은 삼각형 타일 — 홈에만 쓰는 "대담함의 한 곳" (5-2). 계산기 화면은 사선.
	타일 목록은 내비게이션과 같은 src/lib/nav.ts를 쓴다 (순서·준비 상태·아이콘이 늘 같다).
-->
<script lang="ts">
	import type { Pathname } from '$app/types';
	import { resolve } from '$app/paths';
	import { localizeHref } from '$lib/paraglide/runtime';
	import { m } from '$lib/paraglide/messages.js';
	import { sections } from '$lib/nav';
	import NavIcon from '$lib/icons/NavIcon.svelte';
	import VanitasSymbol from '$lib/components/VanitasSymbol.svelte';
	import TriangleBackground from '$lib/components/TriangleBackground.svelte';
	import HomeFrame from './HomeFrame.svelte';

	const href = (path: string) => resolve(localizeHref(path) as Pathname);
</script>

<svelte:head>
	<title>{m.app_title()}</title>
</svelte:head>

<!-- 모바일은 레이아웃이 하단 탭바 높이만큼 아래를 비워 두는데, 그 자리까지 홈 배경이 덮도록 아래로 늘인다 -->
<main
	class="relative -mb-[calc(3.5rem+env(safe-area-inset-bottom))] min-h-screen overflow-hidden pb-[calc(3.5rem+env(safe-area-inset-bottom))] lg:mb-0 lg:pb-0"
>
	<!-- 배경층: 레이아웃의 사선을 덮는다 -->
	<div class="absolute inset-0 bg-wash" aria-hidden="true">
		<TriangleBackground />
	</div>

	<!-- 데스크톱은 화면 높이 안에서 위아래 가운데. 모바일은 위에서부터 (하단 탭바가 있어서) -->
	<div
		class="relative mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10 md:min-h-screen md:justify-center"
	>
		<!-- 데스크톱 -->
		<div class="hidden md:block">
			<HomeFrame {sections} />
		</div>

		<!-- 모바일: 원이 놓이는 띠의 높이를 타일과 맞춘다 (디자인 이슈) -->
		<div class="flex flex-col gap-3 md:hidden">
			<div class="flex min-h-24 items-center gap-4 px-1">
				<div class="flex size-20 shrink-0 items-center justify-center rounded-full bg-brand">
					<VanitasSymbol class="w-11 text-white" />
				</div>
				<div>
					<h1 class="font-display text-[1.75rem] font-bold tracking-wide text-ink">
						{m.app_title()}
					</h1>
					<p class="text-sm text-navy">{m.app_tagline()}</p>
				</div>
			</div>
			<ul class="flex flex-col gap-3">
				{#each sections as section (section.path)}
					<li>
						{#if section.ready}
							<a
								href={href(section.path)}
								class="flex min-h-24 items-center gap-4 rounded-xl border border-navy/60 bg-surface p-4 hover:bg-wash focus-visible:outline-2 focus-visible:outline-brand-strong"
							>
								<NavIcon name={section.icon} size={28} class="shrink-0 text-brand-strong" />
								<span class="flex flex-col gap-0.5">
									<span class="font-bold text-ink">{section.label()}</span>
									<span class="text-sm text-navy">{section.description()}</span>
								</span>
							</a>
						{:else}
							<div
								aria-disabled="true"
								class="flex min-h-24 items-center gap-4 rounded-xl border border-dashed border-navy/60 bg-surface/70 p-4"
							>
								<NavIcon name={section.icon} size={28} class="shrink-0 text-navy/60" />
								<span class="flex flex-col gap-0.5">
									<span class="flex items-center gap-2 font-bold text-navy/60">
										{section.label()}
										<span
											class="rounded border border-navy/60 px-1.5 text-xs font-normal text-navy"
										>
											{m.nav_preparing()}
										</span>
									</span>
									<span class="text-sm text-navy/60">{section.description()}</span>
								</span>
							</div>
						{/if}
					</li>
				{/each}
			</ul>
		</div>
	</div>
</main>
