<!--
	내비게이션 아이콘 4종 (디자인 문서 6장). 24px 격자, 선 굵기 2, 좌표는 정수 기준.
	색은 부모의 CSS color가 정한다 (currentColor).
	라벨과 항상 함께 쓰므로 기본은 aria-hidden. 아이콘만 단독으로 쓸 때만 label을 넘긴다.
-->
<script lang="ts" module>
	export type NavIconName = 'planner' | 'pity' | 'level' | 'gem';
</script>

<script lang="ts">
	interface Props {
		name: NavIconName;
		/** 크기(px 기준). 화면 배율을 따라가도록 rem으로 바꿔 그린다 */
		size?: number;
		/** 아이콘만 단독으로 쓸 때 화면 낭독기용 이름 */
		label?: string;
		class?: string;
	}

	let { name, size = 24, label = '', class: className = '' }: Props = $props();
</script>

<svg
	viewBox="0 0 24 24"
	style="width: {size / 16}rem; height: {size / 16}rem"
	fill="none"
	stroke="currentColor"
	stroke-width="2"
	stroke-linecap="round"
	stroke-linejoin="round"
	class={className}
	role={label ? 'img' : undefined}
	aria-hidden={label ? undefined : 'true'}
>
	{#if label}<title>{label}</title>{/if}

	{#if name === 'planner'}
		<!-- 픽업 플래너: 달력 -->
		<rect x="3" y="5" width="18" height="16" rx="2" />
		<path d="M8 3v4M16 3v4M3 10h18" />
		<path d="M8 15h0M12 15h0M16 15h0" />
	{:else if name === 'pity'}
		<!-- 천장·확률 계산기: 과녁 -->
		<circle cx="12" cy="12" r="9" />
		<circle cx="12" cy="12" r="5" />
		<path d="M12 12h0" />
	{:else if name === 'level'}
		<!-- 레벨업 계산기: 번개 -->
		<path d="M13 2 3 14h9l-1 8 10-12h-9z" />
	{:else if name === 'gem'}
		<!-- 청휘석 수급 계산기: 육각형 (내부 선 없음) -->
		<path d="M12 3l8 5v8l-8 5-8-5V8z" />
	{/if}
</svg>
