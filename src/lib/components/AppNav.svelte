<!--
	사이트 내비게이션. 디자인 문서 5-4.
	- 데스크톱(lg 이상): 좌측 세로 목록
	- 모바일·태블릿: 하단 탭바
	두 화면의 항목 순서는 같다. 아이콘(6장)과 라벨을 항상 함께 둔다.
	현재 위치는 색만이 아니라 굵기와 표식(막대)으로도 표시한다.
	아이콘 색 (5-4): 활성 brand-strong / 비활성 brand / 준비 중 navy 60%. 라벨은 비활성 navy
	띄운 판 (2026-10-23, 디자인 문서 5-19): 목록과 탭바는 화면 가장자리에서 떨어진 e1 판이다.
	현재 위치 = 옅은 하늘색 띠 + 60° 기운 막대 + brand-strong 굵게. 띠는 sky 12%까지 —
	그보다 진하면 띠 위의 brand-strong 글자가 4.5:1 아래로 내려간다 (18%에서 4.4)
-->
<script lang="ts">
	import type { Pathname } from '$app/types';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { localizeHref } from '$lib/paraglide/runtime';
	import { m } from '$lib/paraglide/messages.js';
	import { sections as items } from '$lib/nav';
	import NavIcon from '$lib/icons/NavIcon.svelte';
	import BackupButton from './BackupButton.svelte';

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

<!-- 데스크톱: 좌측 세로 목록. 바깥 aside는 자리만 잡고, 안쪽이 떠 있는 판 -->
<aside class="sticky top-0 hidden h-screen w-64 shrink-0 p-4 lg:block">
	<div class="flex h-full flex-col rounded-xl border border-white bg-surface/92 shadow-e1">
		<a
			href={href('/')}
			class="block px-5 py-6 font-display text-[1.375rem] font-bold tracking-wide text-ink"
			>{m.app_title()}</a
		>
		<nav aria-label={m.nav_label()}>
			<ul class="flex flex-col gap-0.5 px-2">
				{#each items as item (item.path)}
					<li>
						{#if item.ready}
							<a
								href={href(item.path)}
								aria-current={isCurrent(item.path) ? 'page' : undefined}
								class="group relative flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm text-navy focus-visible:outline-2 focus-visible:outline-brand-strong aria-[current=page]:bg-linear-to-r aria-[current=page]:from-sky/12 aria-[current=page]:to-transparent aria-[current=page]:font-bold aria-[current=page]:text-brand-strong"
							>
								{#if isCurrent(item.path)}
									<span
										aria-hidden="true"
										class="absolute top-1/2 left-0 h-5 w-1 -translate-y-1/2 -skew-x-30 rounded-[1px_2px] bg-brand-strong"
									></span>
								{/if}
								<NavIcon
									name={item.icon}
									class="shrink-0 text-brand group-aria-[current=page]:text-brand-strong"
								/>
								{item.label()}
							</a>
						{:else}
							<span
								aria-disabled="true"
								class="flex min-h-11 items-center gap-3 px-3 text-sm text-navy/60"
							>
								<NavIcon name={item.icon} class="shrink-0 text-navy/60" />
								{item.label()}
								<span
									class="ml-auto rounded border border-navy/60 px-1.5 text-[0.625rem] text-navy"
								>
									{m.nav_preparing()}
								</span>
							</span>
						{/if}
					</li>
				{/each}
			</ul>
		</nav>
		<!-- 맨 아래: 정보와 출처, 백업 링크 (다른 기기로 입력 옮기기) -->
		<div class="mt-auto">
			<a
				href={href('/about')}
				aria-current={isCurrent('/about') ? 'page' : undefined}
				class="mx-3 mb-3 flex min-h-9 items-center gap-2 rounded-lg px-2 text-sm text-navy hover:bg-wash hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-strong aria-[current=page]:font-bold aria-[current=page]:text-brand-strong"
			>
				<svg
					class="size-4"
					viewBox="0 0 16 16"
					fill="none"
					stroke="currentColor"
					stroke-width="1.75"
					stroke-linecap="round"
					aria-hidden="true"
				>
					<circle cx="8" cy="8" r="6.25" />
					<path d="M8 7.25v4M8 4.75v.01" />
				</svg>
				{m.nav_about()}
			</a>
			<BackupButton variant="nav" />
		</div>
	</div>
</aside>

<!--
	모바일·태블릿: 하단 탭바. 좌우·아래에서 띄운 판 (5-19). 아래 간격은 10px과 홈 인디케이터 영역 중 큰 쪽.
	내용이 가려지지 않게 비우는 높이는 layout.css의 --tabbar-space 하나로 맞춘다 (레이아웃·홈·알림이 같이 쓴다)
	목록과 달리 불투명하다: 내용이 이 아래로 스크롤되는데 블러를 쓰지 않으므로, 비치면 아래 글자가 탭 라벨과 겹쳐 읽힌다
-->
<nav
	aria-label={m.nav_label()}
	hidden={typing}
	class="fixed inset-x-2.5 bottom-[max(0.625rem,env(safe-area-inset-bottom))] z-10 rounded-2xl border border-white bg-surface shadow-e1 lg:hidden"
>
	<ul class="flex h-14">
		{#each items as item (item.path)}
			<li class="flex-1">
				{#if item.ready}
					<a
						href={href(item.path)}
						aria-current={isCurrent(item.path) ? 'page' : undefined}
						class="group relative flex h-full flex-col items-center justify-center gap-0.5 text-[0.6875rem] text-navy aria-[current=page]:font-bold aria-[current=page]:text-brand-strong"
					>
						{#if isCurrent(item.path)}
							<span
								aria-hidden="true"
								class="absolute top-0 left-1/2 h-1 w-6.5 -translate-x-1/2 -skew-x-30 rounded-[1px_2px] bg-brand-strong"
							></span>
						{/if}
						<NavIcon
							name={item.icon}
							class="shrink-0 text-brand group-aria-[current=page]:text-brand-strong"
						/>
						{item.short()}
					</a>
				{:else}
					<span
						aria-disabled="true"
						class="flex h-full flex-col items-center justify-center gap-0.5 text-[0.6875rem] text-navy/60"
					>
						<NavIcon name={item.icon} class="shrink-0 text-navy/60" />
						{item.short()}
						<span class="sr-only">{m.nav_preparing()}</span>
					</span>
				{/if}
			</li>
		{/each}
	</ul>
</nav>
