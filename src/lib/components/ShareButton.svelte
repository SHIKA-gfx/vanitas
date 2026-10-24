<!--
	공유 링크 복사 버튼 (결과 카드 아래). 지금 입력값을 담은 주소를 클립보드에 복사한다.
	링크에는 결과가 아니라 입력값이 담긴다 — 받은 사람이 열면 그 시점의 데이터로 다시 계산된다.
	클립보드를 쓸 수 없는 환경(일부 내장 브라우저 등)에서는 주소를 보여주는 창으로 대신한다.
	기울인 버튼 (2026-10-23, 5-19): 누르면 무언가 바뀌는 조작은 60° 기울인다. 모서리는 둔각 3·예각 8px, 글자는 반대로 기울여 세운다.
	결과판의 주 버튼이라 brand-strong 채움 + 흰 글자 (4.93:1)
-->
<script lang="ts">
	import { onDestroy } from 'svelte';
	import { page } from '$app/state';
	import { m } from '$lib/paraglide/messages.js';
	import { calcName, track } from '$lib/analytics';
	import Toast from './Toast.svelte';

	interface Props {
		/** 복사할 주소를 만든다 (persistSection().shareUrl) */
		url: () => string;
	}

	let { url }: Props = $props();

	let copied = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;

	async function copy() {
		const link = url();
		try {
			await navigator.clipboard.writeText(link);
			track('share-copy', { calc: calcName(page.route.id) });
			clearTimeout(timer);
			copied = true;
			timer = setTimeout(() => (copied = false), 3000);
		} catch {
			window.prompt(m.share_copy_failed(), link);
		}
	}

	onDestroy(() => clearTimeout(timer));
</script>

<button
	type="button"
	onclick={copy}
	class="mr-2.5 inline-flex min-h-10 -skew-x-30 items-center rounded-[3px_8px] bg-brand-strong px-5 text-sm font-bold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_8px_16px_-8px_rgb(10_111_214/0.8)] transition-colors hover:bg-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong"
>
	<span class="inline-flex skew-x-30 items-center gap-1.5">
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
			<path d="M6.5 9.5a3 3 0 0 0 4.2 0l2.3-2.3a3 3 0 0 0-4.2-4.2l-.8.8" />
			<path d="M9.5 6.5a3 3 0 0 0-4.2 0L3 8.8a3 3 0 0 0 4.2 4.2l.8-.8" />
		</svg>
		{m.share_copy()}
	</span>
</button>

{#if copied}
	<Toast>{m.share_copied()}</Toast>
{/if}
