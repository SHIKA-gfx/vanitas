<!--
	작은 상태 표시. 의미 색은 디자인 문서 2-4 (게임 상성표 색).
	- neutral   테두리만 (추정 표시 등)
	- secured   확보 — 파랑 면, 흰 글자 4.93
	- shortfall 부족 — Weak 주황 면, ink 글자 7.40 (주황 면 위 흰 글자는 금지)
	- blocked   불가 — 빨강 면, 흰 글자 9.40
	색만으로 뜻을 전하지 않는다. 배지 안의 글자가 늘 뜻을 말한다.
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

<span class="inline-block rounded px-1.5 py-0.5 text-xs leading-none font-bold {TONE_CLASS[tone]}">
	{@render children()}
</span>
