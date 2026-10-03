<!--
	공유 링크 복사 버튼 (결과 카드 아래). 지금 입력값을 담은 주소를 클립보드에 복사한다.
	링크에는 결과가 아니라 입력값이 담긴다 — 받은 사람이 열면 그 시점의 데이터로 다시 계산된다.
	클립보드를 쓸 수 없는 환경(일부 내장 브라우저 등)에서는 주소를 보여주는 창으로 대신한다.
-->
<script lang="ts">
	import { onDestroy } from 'svelte';
	import { m } from '$lib/paraglide/messages.js';
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
	class="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-sm text-brand-strong transition-colors hover:bg-wash focus-visible:outline-2 focus-visible:outline-brand-strong"
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
		<path d="M6.5 9.5a3 3 0 0 0 4.2 0l2.3-2.3a3 3 0 0 0-4.2-4.2l-.8.8" />
		<path d="M9.5 6.5a3 3 0 0 0-4.2 0L3 8.8a3 3 0 0 0 4.2 4.2l.8-.8" />
	</svg>
	{m.share_copy()}
</button>

{#if copied}
	<Toast>{m.share_copied()}</Toast>
{/if}
