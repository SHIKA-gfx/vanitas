<!--
	화면에 뜨는 알림 (2026-10-02). role="status"라 화면 낭독기가 내용을 읽어준다.
	초기화의 "되돌리기", 링크 복사 완료, 공유 링크 보기 띠, 백업 안내가 같은 모양을 쓴다.

	- 문서 맨 끝(body)으로 옮겨서 띄운다 (portal). 어느 부품 안에서 띄워도 화면 맨 위 층에 뜬다
	- 글(children)과 버튼(actions)을 나눠 받는다. 버튼은 늘 오른쪽 — 글이 길어 줄이 바뀌면
	  버튼은 다음 줄의 오른쪽 끝으로 간다 (모바일·데스크톱 같은 정렬)

	자리 (place)
	  bottom  모바일은 하단 탭바 위, 넓은 화면은 화면 아래 가운데 (기본)
	  center  모바일은 bottom과 같고, 넓은 화면은 화면 한가운데 — 왼쪽 목록 맨 아래처럼
	          누른 곳에서 화면 아래 가운데가 멀어 반응이 없는 것처럼 느껴질 때
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { portal } from '$lib/actions/portal';

	interface Props {
		children: Snippet;
		/** 오른쪽에 놓이는 버튼들 (되돌리기, 확인 등) */
		actions?: Snippet;
		place?: 'bottom' | 'center';
	}

	let { children, actions, place = 'bottom' }: Props = $props();
</script>

<div
	use:portal
	class="pointer-events-none fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom)+0.75rem)] z-50 flex justify-center px-4 {place ===
	'center'
		? 'lg:inset-0 lg:items-center'
		: 'lg:bottom-6'}"
>
	<div
		role="status"
		class="pointer-events-auto flex w-full max-w-xl flex-wrap items-end gap-x-4 gap-y-2 rounded-lg bg-navy px-4 py-3 text-sm leading-relaxed text-white shadow-panel sm:w-auto {place ===
		'center'
			? 'lg:max-w-md lg:px-6 lg:py-5'
			: ''}"
	>
		<span class="min-w-0 flex-1 basis-56">{@render children()}</span>
		{#if actions}
			<span class="ml-auto flex shrink-0 gap-4">{@render actions()}</span>
		{/if}
	</div>
</div>
