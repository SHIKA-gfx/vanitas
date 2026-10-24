<!--
	계산기 제목 줄 (2026-10-23, 디자인 문서 5-19): 아이콘 칩 + 제목 + 동작(입력 초기화).
	- 아이콘 칩: 흰 원(e1) + NavIcon brand-strong. 홈 타일 아이콘과 같은 그림이라, 화면 전환 때 둘을 짝짓는다
	  (vt-icon-{icon}, layout.css "화면 전환")
	- 칩 지름 = 제목 글자 크기 × 1.7 → 넓은 화면 제목 28px·칩 48px, 모바일 제목 24px·칩 40px. 아이콘은 칩의 55%
	  380px보다 좁은 화면은 제목 22px — 가장 긴 제목("청휘석 수급 계산기")이 360px에서 칩·초기화·홈 원과 한 줄에 들어가도록
	  (24px이면 두 줄로 꺾이고 초기화 버튼이 홈 원 옆으로 밀려났다)
	- 배경 위에 바로 놓이므로 글자는 ink만 (5-19 대비 규칙: 배경 위 brand-strong은 4.5:1 미달)
	- 오른쪽 위에 홈 링크 원(모바일 44px, 넓은 화면 48px — +layout.svelte)이 떠 있어 그만큼 오른쪽을 비운다
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import NavIcon, { type NavIconName } from '$lib/icons/NavIcon.svelte';

	interface Props {
		title: string;
		/** 이 계산기의 아이콘 (nav.ts의 아이콘과 같게) */
		icon: NavIconName;
		/** 제목 오른쪽의 동작 (입력 초기화) */
		actions?: Snippet;
		/** 배치용 클래스 (예: 격자에서 여러 칸 차지하기 md:col-span-2) */
		class?: string;
	}

	let { title, icon, actions, class: className = '' }: Props = $props();
</script>

<div class="flex min-h-11 items-center gap-2 pr-12 lg:pr-14 {className}">
	<span
		class="flex size-10 shrink-0 items-center justify-center rounded-full border border-white bg-surface/94 shadow-e1 md:size-12"
	>
		<span class="flex" style:view-transition-name="vt-icon-{icon}">
			<NavIcon name={icon} class="size-[1.375rem]! text-brand-strong md:size-[1.625rem]!" />
		</span>
	</span>
	<h1 class="text-[1.375rem] font-bold text-ink min-[380px]:text-2xl md:text-[1.75rem]">{title}</h1>
	{@render actions?.()}
</div>
