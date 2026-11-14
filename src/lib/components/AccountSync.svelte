<!--
	계정 맞추기를 켜고 끄고, 두 값이 다르면 묻는 창 (docs/007 4·5장, ⑥-3). 최상위 레이아웃에 하나.
	- 로그인했고 공유 링크를 보는 중이 아니면 켠다 (accountSync.start). 로그아웃·공유 보기면 끈다
	- 묻기 창: 이 기기 값과 계정 값의 요약(보유 청휘석, 플래너 목표 수, 계정 저장 시각)을 나란히 보여 주고 고르게 한다.
	  고르지 않은 쪽은 사라진다. "나중에"를 고르면 이번에는 맞추지 않고, 계정 창에서 다시 고를 수 있다
-->
<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { account } from '$lib/account.svelte';
	import { accountSync } from '$lib/sync.svelte';
	import { summarize } from '$lib/sync';
	import { getSavedStore } from '$lib/state/saved.svelte';

	const store = getSavedStore();
	const id = $props.id();
	let dialog = $state<HTMLDialogElement | null>(null);
	let busy = $state(false);

	$effect(() => {
		const userId = account.user?.id ?? null;
		if (!userId || store.paused) accountSync.stop();
		else void accountSync.start(store, userId);
	});

	$effect(() => {
		if (!dialog) return;
		if (accountSync.conflict && !dialog.open) dialog.showModal();
		if (!accountSync.conflict && dialog.open) dialog.close();
	});

	const device = $derived(accountSync.conflict ? summarize(accountSync.conflict.local) : null);
	const remote = $derived(
		accountSync.conflict ? summarize(accountSync.conflict.remote.data) : null
	);
	const remoteAt = $derived(
		accountSync.conflict ? formatTime(new Date(accountSync.conflict.remote.updatedAt)) : ''
	);

	function formatTime(d: Date): string {
		return new Intl.DateTimeFormat('ko-KR', {
			month: 'numeric',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		}).format(d);
	}

	const gemsLine = (gems: number | null) =>
		m.sync_summary_gems({ gems: (gems ?? 0).toLocaleString('ko-KR') });
	const targetsLine = (targets: number | null) => m.sync_summary_targets({ count: targets ?? 0 });

	async function choose(which: 'device' | 'account') {
		busy = true;
		try {
			await accountSync.choose(which);
		} finally {
			busy = false;
		}
	}

	function later() {
		accountSync.postpone();
		dialog?.close();
	}

	const CARD = 'flex flex-1 flex-col gap-1 rounded-lg bg-wash p-3 text-sm text-ink';
	const BTN =
		'min-h-11 flex-1 rounded-lg px-4 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong disabled:opacity-60';
</script>

<dialog
	bind:this={dialog}
	aria-labelledby="{id}-title"
	class="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-xl border border-white bg-surface p-0 text-ink shadow-e1 backdrop:bg-navy/40"
	oncancel={(e) => {
		// Esc는 "나중에"와 같다
		e.preventDefault();
		later();
	}}
>
	{#if accountSync.conflict && device && remote}
		<div class="flex flex-col gap-4 p-5">
			<h2 id="{id}-title" class="text-lg font-bold text-ink">{m.sync_conflict_title()}</h2>
			<p class="text-sm leading-relaxed text-navy">{m.sync_conflict_body()}</p>
			<div class="flex flex-col gap-2 sm:flex-row">
				<div class={CARD}>
					<p class="font-bold">{m.sync_conflict_device()}</p>
					<p>{gemsLine(device.gems)}</p>
					<p>{targetsLine(device.targets)}</p>
				</div>
				<div class={CARD}>
					<p class="font-bold">{m.sync_conflict_account()}</p>
					<p>{gemsLine(remote.gems)}</p>
					<p>{targetsLine(remote.targets)}</p>
					<p class="text-xs text-navy">{m.sync_summary_saved({ time: remoteAt })}</p>
				</div>
			</div>
			<div class="flex flex-col gap-2 sm:flex-row">
				<button
					type="button"
					disabled={busy}
					onclick={() => choose('device')}
					class="{BTN} border border-navy/25 text-navy hover:bg-wash"
				>
					{m.sync_use_device()}
				</button>
				<button
					type="button"
					disabled={busy}
					onclick={() => choose('account')}
					class="{BTN} bg-brand-strong text-white hover:brightness-110"
				>
					{m.sync_use_account()}
				</button>
			</div>
			<button
				type="button"
				disabled={busy}
				onclick={later}
				class="self-center rounded-lg px-3 py-2 text-sm text-navy underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-brand-strong"
			>
				{m.sync_later()}
			</button>
		</div>
	{/if}
</dialog>
