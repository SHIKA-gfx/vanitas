<!--
	/ko/extra — 부가기능 허브 (2026-11-16, docs/008 4장).
	홈 가운데 원(데스크톱)과 홈 맨 아래 카드(모바일)에서 온다. 카드 목록은 src/lib/extras.ts.
	카드 모양은 모바일 홈 타일과 같다 — 배경 위에 바로 놓이는 흰 판, 준비 중은 점선 + 배지.
-->
<script lang="ts">
	import type { Pathname } from '$app/types';
	import { resolve } from '$app/paths';
	import { localizeHref } from '$lib/paraglide/runtime';
	import { m } from '$lib/paraglide/messages.js';
	import { extras } from '$lib/extras';
	import { track } from '$lib/analytics';
	import Seo from '$lib/components/Seo.svelte';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import NavIcon from '$lib/icons/NavIcon.svelte';

	// 링크 주소는 이 파일 안에서 resolve()로 만든다 (svelte/no-navigation-without-resolve)
	const href = (path: string) => resolve(localizeHref(path) as Pathname);
</script>

<Seo title={`${m.extra_title()} | ${m.app_title()}`} description={m.meta_extra_description()} />

<main class="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-6">
	<div class="flex flex-col gap-2">
		<PageTitle title={m.extra_title()} icon="extra" />
		<!-- 배경 위 글자는 ink·navy만 (디자인 문서 5-19 대비 규칙) -->
		<p class="text-navy">{m.extra_intro()}</p>
	</div>

	<ul class="flex flex-col gap-3">
		{#each extras as extra (extra.id)}
			<li>
				{#if extra.ready}
					<a
						href={href(extra.path)}
						onclick={() => track('extra-open', { id: extra.id })}
						class="flex min-h-24 items-center gap-4 rounded-xl border border-navy/60 bg-surface p-4 hover:bg-wash focus-visible:outline-2 focus-visible:outline-brand-strong"
					>
						<!-- 화면 전환 때 스토리 화면 제목 옆 아이콘 칩과 짝지어진다 (vt-icon-*) -->
						<span class="flex shrink-0" style:view-transition-name="vt-icon-{extra.icon}">
							<NavIcon name={extra.icon} size={28} class="text-brand-strong" />
						</span>
						<span class="flex flex-col gap-0.5">
							<span class="font-bold text-ink">{extra.title()}</span>
							<span class="text-sm text-navy">{extra.summary()}</span>
						</span>
					</a>
				{:else}
					<div
						aria-disabled="true"
						class="flex min-h-24 items-center gap-4 rounded-xl border border-dashed border-navy/60 bg-surface/70 p-4"
					>
						<NavIcon name={extra.icon} size={28} class="shrink-0 text-navy/60" />
						<span class="flex flex-col gap-0.5">
							<span class="flex items-center gap-2 font-bold text-navy/60">
								{extra.title()}
								<span class="rounded border border-navy/60 px-1.5 text-xs font-normal text-navy">
									{m.nav_preparing()}
								</span>
							</span>
							<span class="text-sm text-navy/60">{extra.summary()}</span>
						</span>
					</div>
				{/if}
			</li>
		{/each}
	</ul>
</main>
