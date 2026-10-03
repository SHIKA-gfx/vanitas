<!--
	백업 링크 만들기 (2026-10-02). 저장된 입력 전체(세 계산기 + 공유 값)를 담은 주소를 복사한다.
	로그인 없이 다른 기기·브라우저로 입력을 옮기는 용도 — 결과 공유 링크(ShareButton)와 다르다.
	남에게 주면 입력이 모두 보이므로 복사 알림에서 함께 알린다.

	놓는 곳: 넓은 화면은 왼쪽 목록 맨 아래(variant="nav"), 모바일·태블릿은 홈 맨 아래 탭바 위(variant="block").
	계산기 화면 안에는 두지 않는다 — 결과 공유의 "링크 복사"와 헷갈리지 않게.
	설명은 늘 보이지 않게 하고(홈은 간결하게), 버튼 오른쪽 위의 "?"로 펼친다 — 입력칸 도움말과 같은 방식.
	복사 알림은 넓은 화면에서 화면 한가운데에 띄운다 (목록 맨 아래에서 누르면 화면 아래 가운데는 너무 멀다).
-->
<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { Pathname } from '$app/types';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { localizeHref } from '$lib/paraglide/runtime';
	import { m } from '$lib/paraglide/messages.js';
	import { track } from '$lib/analytics';
	import { getSavedStore } from '$lib/state/saved.svelte';
	import { BACKUP_PARAM, encodeBackup } from '$lib/state/backup';
	import HelpButton from './HelpButton.svelte';
	import Toast from './Toast.svelte';

	let { variant = 'block' }: { variant?: 'nav' | 'block' } = $props();

	const store = getSavedStore();
	const id = $props.id();
	let helpOpen = $state(false);
	let copied = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;

	async function copy() {
		const code = await encodeBackup(store.exportFile());
		// 백업 링크는 홈으로 연다. 홈에서 "불러올까요?"를 묻는다
		const link = `${page.url.origin}${resolve(localizeHref('/') as Pathname)}?${BACKUP_PARAM}=${code}`;
		try {
			await navigator.clipboard.writeText(link);
			track('backup-create', { where: variant === 'nav' ? 'nav' : 'home' });
			helpOpen = false;
			clearTimeout(timer);
			copied = true;
			timer = setTimeout(() => (copied = false), 8000);
		} catch {
			window.prompt(m.share_copy_failed(), link);
		}
	}

	function close() {
		clearTimeout(timer);
		copied = false;
	}

	onDestroy(() => clearTimeout(timer));
</script>

<div class="relative {variant === 'nav' ? 'mx-3 mb-5' : 'inline-block'}">
	<button
		type="button"
		onclick={copy}
		class="inline-flex items-center justify-center gap-2 rounded-lg border border-navy/15 bg-surface px-4 text-sm text-navy transition-colors hover:border-navy/35 hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-strong {variant ===
		'nav'
			? 'min-h-10 w-full'
			: 'min-h-11 shadow-panel'}"
	>
		<svg
			class="size-4"
			viewBox="0 0 16 16"
			fill="none"
			stroke="currentColor"
			stroke-width="1.75"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<path d="M3 10.5v2a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-2" />
			<path d="M8 2.5v8M5 7.5l3 3 3-3" />
		</svg>
		{m.backup_create()}
	</button>

	<!-- 버튼 오른쪽 위 모서리에 걸친 "?" -->
	<span class="absolute -top-2.5 -right-2.5 rounded-full bg-surface">
		<HelpButton label={m.backup_create()} controls="{id}-help" bind:open={helpOpen} />
	</span>

	<!--
		설명: 버튼 위로 펼친다 (화면 맨 아래에 있어서).
		홈에서는 버튼 가운데를 기준으로 좌우 같은 폭으로, 왼쪽 목록에서는 목록 폭에 맞춰.
	-->
	<p
		id="{id}-help"
		hidden={!helpOpen}
		class="absolute bottom-full z-20 mb-3 rounded-lg border border-navy/10 bg-surface p-3 text-left text-xs leading-relaxed text-navy shadow-panel {variant ===
		'nav'
			? 'right-0 left-0'
			: 'left-1/2 w-64 -translate-x-1/2'}"
	>
		{m.backup_help()}
	</p>
</div>

{#if copied}
	<Toast place="center">
		{m.backup_copied()}
		{#snippet actions()}
			<button
				type="button"
				onclick={close}
				class="font-bold text-sky underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-white"
			>
				{m.common_ok()}
			</button>
		{/snippet}
	</Toast>
{/if}
