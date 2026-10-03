<script lang="ts">
	import type { Pathname } from '$app/types';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { locales, localizeHref } from '$lib/paraglide/runtime';
	import './layout.css';
	import AppNav from '$lib/components/AppNav.svelte';
	import VanitasSymbol from '$lib/components/VanitasSymbol.svelte';
	import SharedViewBar from '$lib/components/SharedViewBar.svelte';
	import BackupImportBar from '$lib/components/BackupImportBar.svelte';
	import SiteFooter from '$lib/components/SiteFooter.svelte';
	import { m } from '$lib/paraglide/messages.js';
	import { provideUserState } from '$lib/state/user-state.svelte';
	import { provideSavedStore } from '$lib/state/saved.svelte';

	let { children } = $props();

	// 여러 계산기가 함께 쓰는 값. 방문자마다 하나씩 만들어 모든 페이지에 내려준다
	// 브라우저 저장: 공유 값은 여기서, 계산기별 입력은 각 페이지에서 (src/lib/state/saved.svelte.ts)
	provideSavedStore(provideUserState());

	// 모바일·태블릿에는 하단 탭바에 홈이 없다 → 홈이 아닌 화면의 오른쪽 위에 로고를 두어 홈으로 (2026-10-01)
	const isHome = $derived(page.route.id === '/');
	// 한 줄 푸터: 홈은 자기 배치 안에서 따로 그리고, 정보 페이지는 자기 자신을 가리키므로 뺀다
	const showFooter = $derived(!isHome && page.route.id !== '/about');
	const homeHref = $derived(resolve(localizeHref('/') as Pathname));
</script>

<!-- 아이콘 (scripts/make-icons.py가 만든다). 페이지 제목·설명은 각 페이지의 Seo -->
<svelte:head>
	<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
	<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png" />
	<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
	<link rel="manifest" href="/site.webmanifest" />
	<meta name="theme-color" content="#1288f8" />
</svelte:head>

<!-- 배경층: 계산기 화면은 사선 (디자인 문서 5-2). 홈은 6단계에서 삼각형 타일로 덮는다 -->
<div class="min-h-screen bg-diagonal lg:flex">
	<AppNav />
	<!-- 모바일은 하단 탭바(56px) + 홈 인디케이터 영역만큼 아래를 비워, 곡선 아랫부분이 가려지지 않게 한다 -->
	<div class="relative min-w-0 flex-1 pb-[calc(3.5rem+env(safe-area-inset-bottom))] lg:pb-0">
		{#if !isHome}
			<!-- 페이지 제목과 같은 줄 오른쪽. 넓은 화면은 왼쪽 목록 맨 위의 VANITAS가 홈 링크 -->
			<a
				href={homeHref}
				aria-label={m.nav_home()}
				class="absolute top-5 right-4 z-10 flex size-11 items-center justify-center rounded-full bg-brand shadow-panel focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong lg:hidden"
			>
				<VanitasSymbol class="w-6 text-white" />
			</a>
		{/if}
		{@render children()}
		{#if showFooter}
			<footer class="px-4 pt-2 pb-6">
				<SiteFooter />
			</footer>
		{/if}
	</div>
	<SharedViewBar />
	<BackupImportBar />
</div>

<div style="display:none">
	{#each locales as locale (locale)}
		<a href={resolve(localizeHref(page.url.pathname, { locale }) as Pathname)}>{locale}</a>
	{/each}
</div>
