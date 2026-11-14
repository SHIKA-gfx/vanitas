<!--
	/ko/admin — 관리자 페이지 (docs/006 6장, ④-1: 로그인 · 읽기 · 다시 배포).
	- 들어가는 길은 주소뿐 (결정 G). 검색 제외는 hooks.server.ts의 X-Robots-Tag와 아래 meta
	- 브라우저에서만 돈다 (+page.ts ssr=false). 쓰기를 막는 것은 DB 보안 규칙 — 이 화면은 보안 장치가 아니다
	- 관리자 확인(is_admin)에 성공하면 이 브라우저에 표시를 남겨 홈에 "관리자 페이지" 버튼이 보이게 한다 (admin-marker.ts)
	- 문구는 한국어만 (관리 도구라 메시지 파일에 넣지 않는다)
-->
<script lang="ts">
	import type { SupabaseClient, User } from '@supabase/supabase-js';
	import { onMount } from 'svelte';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import Panel from '$lib/components/Panel.svelte';
	import { setAdminMarker } from '$lib/admin-marker';
	import { rememberProvider } from '$lib/account';
	import AdminButton from './AdminButton.svelte';
	import AdminHome from './AdminHome.svelte';
	import LoginForm from './LoginForm.svelte';
	import { checkAdmin, signInMessage } from './admin-data';
	import { getSupabase } from './supabase';

	type View =
		| { kind: 'loading' }
		| { kind: 'no-config' }
		| { kind: 'signed-out' }
		| { kind: 'not-admin'; email: string }
		| { kind: 'admin'; id: string; email: string }
		| { kind: 'error'; message: string };

	let view = $state<View>({ kind: 'loading' });
	// 연결 객체는 통째로만 바뀐다 (안을 추적하지 않는다)
	let sb = $state.raw<SupabaseClient | null>(null);

	async function verify(user: User) {
		const email = user.email ?? '';
		try {
			const ok = await checkAdmin(sb!);
			setAdminMarker(ok);
			view = ok ? { kind: 'admin', id: user.id, email } : { kind: 'not-admin', email };
		} catch (e) {
			view = { kind: 'error', message: (e as Error).message };
		}
	}

	async function signIn(email: string, password: string): Promise<string | null> {
		const { data, error } = await sb!.auth.signInWithPassword({ email, password });
		if (error) return signInMessage(error);
		// 홈의 계정 창이 "구글 계정으로 로그인했어요"로 잘못 쓰지 않게 (구글 로그인이 이어진 관리자 계정, docs/007)
		rememberProvider('email');
		await verify(data.user);
		return null;
	}

	async function signOut() {
		await sb?.auth.signOut();
		setAdminMarker(false);
		rememberProvider(null);
		view = { kind: 'signed-out' };
	}

	onMount(() => {
		sb = getSupabase();
		if (!sb) {
			view = { kind: 'no-config' };
			return;
		}
		// 다른 탭에서 로그아웃했거나 세션이 끝나면 로그인 화면으로 (이 콜백 안에서는 DB를 부르지 않는다)
		const { data } = sb.auth.onAuthStateChange((event) => {
			if (event === 'SIGNED_OUT') {
				setAdminMarker(false);
				view = { kind: 'signed-out' };
			}
		});
		sb.auth.getSession().then(({ data: { session } }) => {
			if (session) verify(session.user);
			else view = { kind: 'signed-out' };
		});
		return () => data.subscription.unsubscribe();
	});
</script>

<svelte:head>
	<title>관리자 | VANITAS</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<main class="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 md:grid md:grid-cols-2 md:items-start">
	<PageTitle title="관리자" class="md:col-span-2">
		{#snippet actions()}
			{#if view.kind === 'admin' || view.kind === 'not-admin'}
				<span class="ml-auto hidden truncate text-sm text-navy sm:inline">{view.email}</span>
				<AdminButton onclick={signOut}>로그아웃</AdminButton>
			{/if}
		{/snippet}
	</PageTitle>

	{#if view.kind === 'loading'}
		<p class="text-sm text-navy md:col-span-2">확인하는 중…</p>
	{:else if view.kind === 'no-config'}
		<Panel title="설정 없음" class="md:col-span-2">
			<p class="text-sm text-ink">
				Supabase 주소·공개용 키(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY)가 이 배포에
				없어요. 로컬은 .env, 사이트는 Cloudflare 환경 변수에 넣어요 (docs/006 5-4).
			</p>
		</Panel>
	{:else if view.kind === 'signed-out'}
		<div class="md:col-span-2">
			<LoginForm {signIn} />
		</div>
	{:else if view.kind === 'not-admin'}
		<Panel title="권한 없음" class="md:col-span-2">
			<p class="text-sm text-ink">
				{view.email} 계정은 관리자가 아니에요. 관리자 목록은 Supabase SQL Editor에서만 바꿀 수 있어요.
			</p>
		</Panel>
	{:else if view.kind === 'error'}
		<Panel title="확인하지 못함" class="md:col-span-2">
			<div class="flex flex-col items-start gap-4">
				<p role="alert" class="text-sm font-bold text-blocked">{view.message}</p>
				<AdminButton onclick={signOut}>로그아웃하고 다시 로그인</AdminButton>
			</div>
		</Panel>
	{:else}
		<AdminHome sb={sb!} me={view.id} />
	{/if}
</main>
