<!--
	오류 화면 (공개 준비 4번, 2026-10-03). 없는 주소(404)면 홈으로 안내하고, 그 밖의 오류는 짧게 알린다.
	레이아웃 안에 그려지므로 왼쪽 목록·하단 탭바로도 이동할 수 있다.
-->
<script lang="ts">
	import type { Pathname } from '$app/types';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { localizeHref } from '$lib/paraglide/runtime';
	import { m } from '$lib/paraglide/messages.js';
	import VanitasSymbol from '$lib/components/VanitasSymbol.svelte';

	const notFound = $derived(page.status === 404);
	const homeHref = resolve(localizeHref('/') as Pathname);
</script>

<svelte:head>
	<title>{notFound ? m.error_not_found_title() : m.error_other_title()} | {m.app_title()}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main
	class="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-4 px-4 py-10 text-center"
>
	<div class="flex size-20 items-center justify-center rounded-full bg-brand">
		<VanitasSymbol class="w-11 text-white" />
	</div>
	<p class="font-display text-[1.75rem] font-bold tracking-wide text-navy">{page.status}</p>
	<h1 class="text-[1.375rem] leading-snug font-bold text-ink">
		{notFound ? m.error_not_found_title() : m.error_other_title()}
	</h1>
	<p class="text-navy">{notFound ? m.error_not_found_body() : m.error_other_body()}</p>
	<a
		href={homeHref}
		class="mt-2 inline-flex min-h-11 items-center rounded-lg bg-brand-strong px-5 font-bold text-white hover:bg-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong"
	>
		{m.error_home()}
	</a>
</main>
