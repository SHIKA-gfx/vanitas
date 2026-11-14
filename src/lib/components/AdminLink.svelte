<!--
	관리자 페이지로 가는 버튼 (2026-11-14, docs/006 6-1 결정 G). 관리자로 로그인한 브라우저에서만 보인다.
	브라우저에 남은 표시(admin-marker.ts)만 읽는다 — Supabase를 부르지 않는다. 보안 장치가 아니다 (/admin 안에서 로그인·DB 규칙이 막는다).

	놓는 곳: 홈에서 백업 링크 바로 위 — 백업 링크와 같은 자리 규칙을 따른다 (BackupButton).
	넓은 화면은 왼쪽 목록 맨 아래(variant="nav", 홈일 때만), 모바일·태블릿은 홈 맨 아래(variant="block").
	넓은 화면의 홈 맨 아래에 두면 1366×768 같은 낮은 화면에서 네 타일과 겹친다 (2026-11-14 확인).
	모양도 백업 링크와 같다 — 기울인 흰 버튼 (5-19)
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import type { Pathname } from '$app/types';
	import { resolve } from '$app/paths';
	import { localizeHref } from '$lib/paraglide/runtime';
	import { hasAdminMarker } from '$lib/admin-marker';

	let { variant = 'block', class: className = '' }: { variant?: 'nav' | 'block'; class?: string } =
		$props();

	// 관리자 페이지에서 로그인·로그아웃한 뒤 돌아오면 다시 읽는다 (왼쪽 목록은 화면을 옮겨도 남아 있다)
	let show = $state(false);
	const read = () => (show = hasAdminMarker());
	onMount(read);
	afterNavigate(read);
</script>

{#if show}
	<div class="{variant === 'nav' ? 'mx-3 mb-3' : 'inline-block'} {className}">
		<a
			href={resolve(localizeHref('/admin') as Pathname)}
			class="inline-flex -skew-x-30 items-center justify-center rounded-[3px_8px] border border-navy/25 bg-surface/70 px-5 text-sm font-bold text-navy shadow-[inset_0_1px_0_#fff] transition-colors hover:border-navy/45 hover:bg-surface hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-strong {variant ===
			'nav'
				? 'min-h-10 w-full'
				: 'mx-3 min-h-11 shadow-e1'}"
		>
			<span class="inline-flex skew-x-30 items-center gap-2">
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
					<rect x="3" y="7" width="10" height="6.5" rx="1" />
					<path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
				</svg>
				관리자 페이지
			</span>
		</a>
	</div>
{/if}
