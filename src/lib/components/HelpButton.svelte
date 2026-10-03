<!--
	입력칸 라벨 옆 "?" 버튼. 누르면 설명이 펼쳐지고, 다시 누르면 접힌다.
	모바일에는 마우스 올리기가 없으므로 툴팁 대신 탭으로 여닫는다 (디자인 문서 5-4, 5-5).
	설명 문단은 필드 컴포넌트가 그리고, 이 버튼은 open 상태만 바꾼다.
-->
<script lang="ts">
	import { page } from '$app/state';
	import { calcName, track } from '$lib/analytics';
	import { m } from '$lib/paraglide/messages.js';

	interface Props {
		/** 어떤 칸의 설명인지 — 화면 낭독기용 이름에 쓴다 */
		label: string;
		/** 펼쳐지는 설명 문단의 id */
		controls: string;
		open: boolean;
	}

	let { label, controls, open = $bindable(false) }: Props = $props();
</script>

<!-- 24px: 터치 목표 최소 크기 (WCAG 2.2 AA). 열림 상태는 색이 아니라 채움으로도 구분한다 -->
<button
	type="button"
	aria-expanded={open}
	aria-controls={controls}
	aria-label={m.common_help_label({ label })}
	onclick={() => {
		open = !open;
		// 어느 칸이 어려운지 (사용 통계)
		if (open) track('help-open', { calc: calcName(page.route.id), field: label });
	}}
	class="inline-flex size-5 items-center justify-center rounded-full border border-navy/40 text-[0.6875rem] font-bold text-navy hover:border-navy focus-visible:outline-2 focus-visible:outline-brand-strong aria-expanded:bg-navy aria-expanded:text-white"
>
	?
</button>
