<script lang="ts">
	import { dev } from '$app/environment';
	import type { Pathname } from '$app/types';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { locales, localizeHref } from '$lib/paraglide/runtime';
	import './layout.css';
	import AppNav from '$lib/components/AppNav.svelte';
	import VanitasSymbol from '$lib/components/VanitasSymbol.svelte';
	import ShittimBackground from '$lib/components/ShittimBackground.svelte';
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
	<!--
		숫자 글꼴 Oxanium (2026-10-23, layout.css). 모바일 계산기 화면에서는 숫자에만 쓰여 늦게 발견된다
		→ 미리 받아 숫자만 뒤늦게 바뀌어 보이지 않게. 약 8KB
	-->
	<link
		rel="preload"
		href="/fonts/Oxanium.woff2"
		as="font"
		type="font/woff2"
		crossorigin="anonymous"
	/>
	<!--
		브라우저 주소창 색 = 화면 바탕 맨 위 screen-top (2026-10-23). 주소창과 화면 위쪽의 경계를 없애
		"기계 화면 한 대"로 보이게. site.webmanifest의 theme_color도 같은 값
	-->
	<meta name="theme-color" content="#aee2ff" />
	<!--
		사용 통계 Umami (이벤트 목록: src/lib/analytics.ts). 개발 서버에서는 불러오지 않고,
		data-domains로 vanitas.live에서 온 방문만 센다 (미리보기 배포·로컬 빌드는 세지 않는다).
		data-do-not-track: 브라우저의 "추적 안 함"을 켠 방문은 세지 않는다.
	-->
	{#if !dev}
		<script
			defer
			src="https://cloud.umami.is/script.js"
			data-website-id="70d30c26-ed3e-40da-8c03-9d2a29a3cd43"
			data-domains="vanitas.live"
			data-do-not-track="true"
		></script>
	{/if}
</svelte:head>

<!--
	배경층: 모든 화면이 같은 싯딤의 상자 배경 (디자인 문서 5-19). 화면에 고정되고 판만 그 위로 스크롤된다.
	isolate로 이 틀 안에 쌓임 맥락을 만들어, 배경(-z-10)이 body 뒤로 빠지지 않고 내용 바로 뒤에 놓이게 한다
-->
<div class="relative isolate min-h-screen lg:flex">
	<ShittimBackground />
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
