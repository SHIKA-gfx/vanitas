<!--
	사이트 내비게이션. 디자인 문서 5-4.
	- 데스크톱(lg 이상): 좌측 세로 목록
	- 모바일·태블릿: 하단 탭바
	두 화면의 항목 순서는 같다. 아이콘 자리는 비워 두고(6장), 라벨은 항상 보인다.
	현재 위치는 색만이 아니라 굵기와 표식(막대)으로도 표시한다.
-->
<script lang="ts">
	import type { Pathname } from '$app/types';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { localizeHref } from '$lib/paraglide/runtime';
	import { m } from '$lib/paraglide/messages.js';

	interface NavItem {
		/** 로케일 접두어 없는 경로. page.route.id와 같은 형태 */
		path: string;
		label: () => string;
		short: () => string;
		/** false면 아직 없는 화면. 링크 대신 "준비 중"으로 보여준다 */
		ready: boolean;
	}

	// 순서가 곧 화면 순서다 (디자인 문서 5-4: 두 화면에서 같게)
	const items: NavItem[] = [
		{ path: '/planner', label: m.nav_planner, short: m.nav_planner_short, ready: false },
		{ path: '/pity', label: m.nav_pity, short: m.nav_pity_short, ready: true },
		{ path: '/levelup', label: m.nav_levelup, short: m.nav_levelup_short, ready: true },
		{ path: '/income', label: m.nav_income, short: m.nav_income_short, ready: false }
	];

	const href = (path: string) => resolve(localizeHref(path) as Pathname);
	const isCurrent = (path: string) => page.route.id?.startsWith(path) ?? false;

	// 모바일에서 입력칸을 누르면 키보드가 올라오므로 그동안 탭바를 숨긴다 (디자인 문서 5-4 미결 사항)
	let typing = $state(false);
	const TYPING_FIELDS = 'input:not([type=checkbox]):not([type=radio]), textarea, select';
	const isTypingField = (el: EventTarget | null) =>
		el instanceof HTMLElement && el.matches(TYPING_FIELDS);

	$effect(() => {
		const onFocusIn = (e: FocusEvent) => (typing = isTypingField(e.target));
		// 다른 입력칸으로 바로 옮겨갈 때 탭바가 깜빡이지 않도록 relatedTarget을 본다
		const onFocusOut = (e: FocusEvent) => (typing = isTypingField(e.relatedTarget));
		document.addEventListener('focusin', onFocusIn);
		document.addEventListener('focusout', onFocusOut);
		return () => {
			document.removeEventListener('focusin', onFocusIn);
			document.removeEventListener('focusout', onFocusOut);
		};
	});
</script>

<!-- 데스크톱: 좌측 세로 목록 -->
<aside
	class="sticky top-0 hidden h-screen w-56 shrink-0 border-r border-navy/15 bg-surface lg:block"
>
	<a href={href('/')} class="block px-5 py-6 text-xl font-bold text-ink">{m.app_title()}</a>
	<nav aria-label={m.nav_label()}>
		<ul>
			{#each items as item (item.path)}
				<li>
					{#if item.ready}
						<a
							href={href(item.path)}
							aria-current={isCurrent(item.path) ? 'page' : undefined}
							class="flex min-h-11 items-center gap-3 border-l-4 border-transparent px-4 text-sm text-navy aria-[current=page]:border-brand-strong aria-[current=page]:font-bold aria-[current=page]:text-brand-strong"
						>
							<span class="size-6 shrink-0" aria-hidden="true"></span>
							{item.label()}
						</a>
					{:else}
						<span
							aria-disabled="true"
							class="flex min-h-11 items-center gap-3 border-l-4 border-transparent px-4 text-sm text-navy/60"
						>
							<span class="size-6 shrink-0" aria-hidden="true"></span>
							{item.label()}
							<span class="ml-auto rounded border border-navy/60 px-1.5 text-[10px] text-navy">
								{m.nav_preparing()}
							</span>
						</span>
					{/if}
				</li>
			{/each}
		</ul>
	</nav>
</aside>

<!-- 모바일·태블릿: 하단 탭바 -->
<nav
	aria-label={m.nav_label()}
	hidden={typing}
	class="fixed inset-x-0 bottom-0 z-10 border-t border-navy/15 bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
>
	<ul class="flex h-14">
		{#each items as item (item.path)}
			<li class="flex-1">
				{#if item.ready}
					<a
						href={href(item.path)}
						aria-current={isCurrent(item.path) ? 'page' : undefined}
						class="flex h-full flex-col items-center justify-center gap-0.5 border-t-2 border-transparent text-[11px] text-navy aria-[current=page]:border-brand-strong aria-[current=page]:font-bold aria-[current=page]:text-brand-strong"
					>
						<span class="size-6" aria-hidden="true"></span>
						{item.short()}
					</a>
				{:else}
					<span
						aria-disabled="true"
						class="flex h-full flex-col items-center justify-center gap-0.5 text-[11px] text-navy/60"
					>
						<span class="size-6" aria-hidden="true"></span>
						{item.short()}
						<span class="sr-only">{m.nav_preparing()}</span>
					</span>
				{/if}
			</li>
		{/each}
	</ul>
</nav>
