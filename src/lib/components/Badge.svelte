<!--
	작은 상태 표시. 의미 색은 디자인 문서 2-4 (게임 상성표 색).
	- neutral   테두리만 (추정 표시 등)
	- secured   확보 — 파랑 면, 흰 글자 4.93
	- shortfall 부족 — Weak 주황 면, ink 글자 7.40 (주황 면 위 흰 글자는 금지)
	- blocked   불가 — 빨강 면, 흰 글자 9.40
	색만으로 뜻을 전하지 않는다. 배지 안의 글자가 늘 뜻을 말한다.
	모양 (2026-10-23, 5-19): 60° 기울인 판, 모서리는 둔각 2px·예각 4px (기울이면 둔각이 더 둥글게 보여 값을 나눈다).
	글자는 반대로 기울여 똑바로 세운다
-->
<script lang="ts" module>
	export type Tone = 'neutral' | 'secured' | 'shortfall' | 'blocked';
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';

	let { tone = 'neutral', children }: { tone?: Tone; children: Snippet } = $props();

	// Tailwind가 찾을 수 있도록 클래스 이름을 통째로 적는다 (조립하지 않는다)
	const TONE_CLASS: Record<Tone, string> = {
		neutral: 'border border-navy/60 text-navy',
		secured: 'bg-secured text-white',
		shortfall: 'bg-shortfall text-ink',
		blocked: 'bg-blocked text-white'
	};
</script>

<span
	class="inline-block -skew-x-30 rounded-[2px_4px] px-2 py-0.5 text-xs leading-none font-bold {TONE_CLASS[
		tone
	]}"
>
	<span class="inline-block skew-x-30">{@render children()}</span>
</span>
