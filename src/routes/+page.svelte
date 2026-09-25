<!--
	/ko — 홈. 로고와 네 화면으로 가는 카드.
	카드 목록은 내비게이션과 같은 src/lib/nav.ts를 쓴다 (순서·준비 상태가 늘 같다).
-->
<script lang="ts">
	import type { Pathname } from '$app/types';
	import { resolve } from '$app/paths';
	import { localizeHref } from '$lib/paraglide/runtime';
	import { m } from '$lib/paraglide/messages.js';
	import { sections } from '$lib/nav';
	import VanitasSymbol from '$lib/components/VanitasSymbol.svelte';

	const href = (path: string) => resolve(localizeHref(path) as Pathname);
</script>

<svelte:head>
	<title>{m.app_title()}</title>
</svelte:head>

<main class="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-10">
	<header class="flex flex-col items-center gap-3 text-center">
		<VanitasSymbol class="size-20 text-brand" />
		<h1 class="text-3xl font-bold text-ink">{m.app_title()}</h1>
		<p class="text-sm text-navy">{m.app_tagline()}</p>
	</header>

	<ul class="grid grid-cols-2 gap-3">
		{#each sections as section (section.path)}
			<li>
				{#if section.ready}
					<a
						href={href(section.path)}
						class="flex h-full min-h-32 flex-col gap-2 rounded border border-navy/15 bg-surface p-4 hover:border-brand-strong focus-visible:outline-2 focus-visible:outline-brand-strong"
					>
						<span class="font-bold text-ink">{section.label()}</span>
						<span class="text-sm text-navy">{section.description()}</span>
					</a>
				{:else}
					<div
						aria-disabled="true"
						class="flex h-full min-h-32 flex-col gap-2 rounded border border-dashed border-navy/60 bg-surface p-4"
					>
						<span class="flex items-center gap-2 font-bold text-navy">
							{section.label()}
							<span class="rounded border border-navy/60 px-1.5 text-[10px] font-normal">
								{m.nav_preparing()}
							</span>
						</span>
						<span class="text-sm text-navy">{section.description()}</span>
					</div>
				{/if}
			</li>
		{/each}
	</ul>
</main>
