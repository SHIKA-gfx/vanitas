<!--
	로그인 · 계정 단추 (docs/007 5장, ⑥-2). 백업 링크 바로 위 (결정 H) — 백업 링크와 같은 자리 규칙·모양.
	넓은 화면은 왼쪽 목록 맨 아래(variant="nav", 모든 화면), 모바일·태블릿은 홈 맨 아래(variant="block").

	- 로그아웃 상태: "로그인" → 창에서 Google / 카카오
	- 로그인 상태: 사람 + 확인 표시 아이콘 + "계정" → 창에서 로그인한 제공자, 로그아웃, 계정 삭제(한 번 더 묻고)
	  아이콘은 다른 단추처럼 선만 (16px, 선 1.75) — 처음의 남색 원 + 흰 글자는 혼자만 면이라 어울리지 않았다 (2026-11-15)
	- ⑥-3 전에는 ?accounts=preview를 붙인 브라우저에서만 보인다 (account.ts ACCOUNTS_OPEN)

	제공자 단추는 글자만 쓴다. 공식 로그인 단추 이미지(구글·카카오 디자인 가이드)를 받아 오면 그때 바꾼다.
	창은 <dialog> — Esc로 닫히고, 열린 동안 뒤쪽은 눌리지 않는다.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import type { Pathname } from '$app/types';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { localizeHref } from '$lib/paraglide/runtime';
	import { m } from '$lib/paraglide/messages.js';
	import { account } from '$lib/account.svelte';
	import { accountsVisible, type Provider } from '$lib/account';

	let { variant = 'block' }: { variant?: 'nav' | 'block' } = $props();

	const id = $props.id();
	let dialog = $state<HTMLDialogElement | null>(null);
	let preview = $state(false);
	let step = $state<'main' | 'confirm-delete'>('main');
	let busy = $state(false);
	let problem = $state<string | null>(null);

	onMount(() => {
		let storage: Storage | undefined;
		try {
			storage = localStorage;
		} catch {
			storage = undefined;
		}
		preview = accountsVisible(page.url.searchParams, storage, false);
		account.start();
	});

	const visible = $derived(preview || account.user !== null);
	const providerLine = $derived.by(() => {
		switch (account.user?.provider) {
			case 'google':
				return m.account_signed_in_google();
			case 'kakao':
				return m.account_signed_in_kakao();
			case 'email':
				return m.account_signed_in_email();
			default:
				return m.account_signed_in();
		}
	});

	function open() {
		step = 'main';
		problem = null;
		dialog?.showModal();
	}

	function close() {
		dialog?.close();
	}

	async function signIn(provider: Provider) {
		busy = true;
		problem = null;
		try {
			const callback = `${page.url.origin}${resolve(localizeHref('/auth/callback') as Pathname)}`;
			await account.signIn(provider, callback, page.url.pathname + page.url.search);
			// 제공자 화면으로 넘어간다 — 여기서 끝
		} catch (e) {
			problem = m.account_error({ message: (e as Error).message });
			busy = false;
		}
	}

	async function signOut() {
		busy = true;
		try {
			await account.signOut();
			close();
		} finally {
			busy = false;
		}
	}

	async function deleteAccount() {
		busy = true;
		problem = null;
		try {
			await account.deleteAccount();
			close();
		} catch (e) {
			const message = (e as Error).message;
			problem = message.includes('관리자')
				? m.account_delete_admin()
				: m.account_error({ message });
		} finally {
			busy = false;
		}
	}

	const SKEW =
		'inline-flex -skew-x-30 items-center justify-center rounded-[3px_8px] border border-navy/25 bg-surface/70 px-5 text-sm font-bold text-navy shadow-[inset_0_1px_0_#fff] transition-colors hover:border-navy/45 hover:bg-surface hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-strong';
	const PROVIDER_BTN =
		'flex min-h-12 w-full items-center justify-center rounded-lg px-4 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong disabled:opacity-60';
	const TEXT_BTN =
		'min-h-11 rounded-lg px-4 text-sm font-bold focus-visible:outline-2 focus-visible:outline-brand-strong disabled:opacity-60';
</script>

{#if visible}
	<div class={variant === 'nav' ? 'mx-3 mb-3' : 'inline-block'}>
		<button
			type="button"
			onclick={open}
			class="{SKEW} {variant === 'nav' ? 'min-h-10 w-full' : 'mx-3 min-h-11 shadow-e1'}"
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
					{#if account.user}
						<!-- 로그인함: 사람 + 확인 표시 -->
						<circle cx="6.5" cy="5.5" r="2.75" />
						<path d="M1.75 14a4.75 4.75 0 0 1 9.5 0" />
						<path d="M10.5 7l1.75 1.75L15 5.75" />
					{:else}
						<circle cx="8" cy="5.5" r="2.75" />
						<path d="M2.75 14a5.25 5.25 0 0 1 10.5 0" />
					{/if}
				</svg>
				{account.user ? m.account_button() : m.account_sign_in()}
			</span>
		</button>
	</div>
{/if}

<dialog
	bind:this={dialog}
	aria-labelledby="{id}-title"
	class="m-auto w-[min(24rem,calc(100vw-2rem))] rounded-xl border border-white bg-surface p-0 text-ink shadow-e1 backdrop:bg-navy/40"
	onclose={() => (step = 'main')}
>
	<div class="flex flex-col gap-4 p-5">
		<div class="flex items-start justify-between gap-3">
			<h2 id="{id}-title" class="text-lg font-bold text-ink">
				{account.user ? m.account_title_signed_in() : m.account_title()}
			</h2>
			<button
				type="button"
				onclick={close}
				aria-label={m.account_close()}
				class="-m-2 inline-flex size-10 items-center justify-center rounded-lg text-navy hover:bg-wash focus-visible:outline-2 focus-visible:outline-brand-strong"
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
					<path d="M4 4l8 8M12 4l-8 8" />
				</svg>
			</button>
		</div>

		{#if !account.user}
			<p class="text-sm leading-relaxed text-navy">{m.account_intro()}</p>
			<div class="flex flex-col gap-2">
				<button
					type="button"
					disabled={busy}
					onclick={() => signIn('google')}
					class="{PROVIDER_BTN} border border-navy/25 bg-surface text-ink hover:bg-wash"
				>
					{m.account_with_google()}
				</button>
				<button
					type="button"
					disabled={busy}
					onclick={() => signIn('kakao')}
					class="{PROVIDER_BTN} bg-[#FEE500] text-black/85 hover:brightness-95"
				>
					{m.account_with_kakao()}
				</button>
			</div>
			<p class="text-xs leading-relaxed text-navy">
				{m.account_privacy_note()}
				<a
					href={resolve(localizeHref('/privacy') as Pathname)}
					onclick={close}
					class="font-bold text-brand-strong underline underline-offset-4 hover:text-ink"
					>{m.privacy_title()}</a
				>
			</p>
		{:else if step === 'main'}
			<div class="flex flex-col gap-1">
				<p class="text-sm font-bold text-ink">{providerLine}</p>
				{#if account.user.name}
					<p class="text-sm text-navy">{account.user.name}</p>
				{/if}
			</div>
			<p class="rounded-lg bg-wash p-3 text-xs leading-relaxed text-navy">
				{m.account_sync_pending()}
			</p>
			<div class="flex flex-wrap items-center justify-between gap-2">
				<button
					type="button"
					disabled={busy}
					onclick={() => {
						step = 'confirm-delete';
						problem = null;
					}}
					class="{TEXT_BTN} text-blocked hover:bg-wash"
				>
					{m.account_delete()}
				</button>
				<button
					type="button"
					disabled={busy}
					onclick={signOut}
					class="{TEXT_BTN} border border-navy/25 text-navy hover:bg-wash"
				>
					{m.account_sign_out()}
				</button>
			</div>
		{:else}
			<p class="text-sm leading-relaxed text-ink">{m.account_delete_ask()}</p>
			<div class="flex flex-wrap justify-end gap-2">
				<button
					type="button"
					disabled={busy}
					onclick={() => (step = 'main')}
					class="{TEXT_BTN} border border-navy/25 text-navy hover:bg-wash"
				>
					{m.account_cancel()}
				</button>
				<button
					type="button"
					disabled={busy}
					onclick={deleteAccount}
					class="{TEXT_BTN} bg-blocked text-white hover:brightness-110"
				>
					{m.account_delete_confirm()}
				</button>
			</div>
		{/if}

		{#if problem}
			<p role="alert" class="text-sm leading-relaxed text-blocked">{problem}</p>
		{/if}
	</div>
</dialog>
