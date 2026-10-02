<!--
	입력 초기화 버튼 (계산기 제목 옆). 누르면 그 계산기의 입력만 기본값으로 돌린다.
	다른 계산기와 함께 쓰는 값(보유 청휘석 등)은 건드리지 않는다.
	실수로 눌렀을 때 만회할 수 있도록, 아래에 6초 동안 "되돌리기" 알림을 띄운다 (2026-10-02).
	모바일은 제목 줄 오른쪽에 홈 로고가 있어 아이콘만, 넓은 화면은 글자까지 보여준다.
-->
<script lang="ts">
	import { onDestroy } from 'svelte';
	import { m } from '$lib/paraglide/messages.js';

	interface Props {
		/** 입력을 기본값으로 돌리고, 되돌리기 함수를 돌려준다 (persistSection().reset) */
		onreset: () => () => void;
	}

	let { onreset }: Props = $props();

	const UNDO_MS = 6000;
	let undo = $state<(() => void) | null>(null);
	let timer: ReturnType<typeof setTimeout> | undefined;

	function reset() {
		clearTimeout(timer);
		undo = onreset();
		timer = setTimeout(() => (undo = null), UNDO_MS);
	}

	function runUndo() {
		clearTimeout(timer);
		undo?.();
		undo = null;
	}

	onDestroy(() => clearTimeout(timer));
</script>

<button
	type="button"
	onclick={reset}
	aria-label={m.common_reset()}
	class="inline-flex size-9 shrink-0 items-center justify-center gap-1.5 rounded-lg text-navy transition-colors hover:bg-surface hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-strong md:w-auto md:px-3"
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
		<path d="M2.5 8a5.5 5.5 0 1 0 1.6-3.9" />
		<path d="M2.5 2.5v3h3" />
	</svg>
	<span class="hidden text-sm md:inline">{m.common_reset()}</span>
</button>

{#if undo}
	<!-- 하단 탭바 위에 뜬다 (넓은 화면은 화면 아래) -->
	<div
		class="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom)+0.75rem)] z-30 flex justify-center px-4 lg:bottom-6"
	>
		<div
			role="status"
			class="flex items-center gap-4 rounded-lg bg-navy px-4 py-3 text-sm text-white shadow-panel"
		>
			{m.common_reset_done()}
			<button
				type="button"
				onclick={runUndo}
				class="font-bold text-sky underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-white"
			>
				{m.common_undo()}
			</button>
		</div>
	</div>
{/if}
