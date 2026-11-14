<!--
	/ko/auth/callback — 구글·카카오 로그인에서 돌아오는 곳 (docs/007 5장, ⑥-2).
	?code=… 를 세션으로 바꾸고, 로그인을 시작한 화면으로 돌아간다 (account.svelte.ts가 기억해 둔 곳).
	오류(취소, 가입 막힘, 훅 거부)는 문장으로 알리고 돌아갈 단추를 둔다.
	검색 제외 — 이 주소 자체는 쓸 내용이 없다.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import type { Pathname } from '$app/types';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { localizeHref } from '$lib/paraglide/runtime';
	import { m } from '$lib/paraglide/messages.js';
	import Panel from '$lib/components/Panel.svelte';
	import { account } from '$lib/account.svelte';
	import { callbackProblem, RETURN_KEY, safeReturnPath } from '$lib/account';

	const home = resolve(localizeHref('/') as Pathname);
	let message = $state<string | null>(null);
	let back = $state<string>(home);

	function returnPath(): string {
		try {
			const saved = sessionStorage.getItem(RETURN_KEY);
			sessionStorage.removeItem(RETURN_KEY);
			return safeReturnPath(saved, home);
		} catch {
			return home;
		}
	}

	onMount(async () => {
		back = returnPath();
		const problem = callbackProblem(page.url.searchParams);
		if (problem) {
			message =
				problem.kind === 'cancelled'
					? m.auth_callback_cancelled()
					: problem.kind === 'signup-closed'
						? m.auth_callback_signup_closed()
						: problem.kind === 'rejected'
							? problem.message
							: problem.kind === 'failed'
								? m.auth_callback_failed({ message: problem.message })
								: m.auth_callback_no_code();
			return;
		}
		try {
			await account.finish(page.url.searchParams.get('code')!);
			// 주소의 code를 기록에 남기지 않는다
			// eslint-disable-next-line svelte/no-navigation-without-resolve -- back은 resolve한 홈 또는 이 사이트 안의 경로 (safeReturnPath)
			await goto(back, { replaceState: true });
		} catch (e) {
			message = m.auth_callback_failed({ message: (e as Error).message });
		}
	});
</script>

<svelte:head>
	<title>{m.account_title()} | {m.app_title()}</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<main class="mx-auto flex max-w-md flex-col gap-6 px-4 py-10">
	<Panel>
		<div class="flex flex-col gap-4">
			<h1 class="text-lg font-bold text-ink">{m.account_title()}</h1>
			{#if message}
				<p role="alert" class="leading-relaxed text-ink">{message}</p>
				<!-- eslint-disable svelte/no-navigation-without-resolve -- back은 resolve한 홈 또는 이 사이트 안의 경로 -->
				<a
					href={back}
					class="self-start font-bold text-brand-strong underline underline-offset-4 hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-strong"
					>{m.auth_callback_back()}</a
				>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			{:else}
				<p class="text-navy" aria-live="polite">{m.auth_callback_working()}</p>
			{/if}
		</div>
	</Panel>
</main>
