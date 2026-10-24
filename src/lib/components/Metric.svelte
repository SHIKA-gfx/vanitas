<!--
	결과 숫자 하나 + 설명 한 줄. 데이터층 (디자인 문서 5-2) — 장식을 넣지 않는다.
	tone으로 숫자에 의미 색을 입힐 수 있다 (부족은 글자용 shortfall-strong).
	칸 바탕 (2026-10-23, 5-19): 보통은 wash, 판정 색을 입힌 결과판 안에서는 흰색 86% + 머리카락 테두리.
	옅은 파랑 판 위의 wash 칸은 1.01~1.08:1이라 칸이 사라진다. 숫자는 칸 폭에 따라 18~22px — 판정 문장보다 작게 (5-14)
-->
<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { MOTION, isClientArrival, isTyping, reducedMotion } from '$lib/motion';
	import type { Tone } from './Badge.svelte';

	interface Props {
		label: string;
		value: string;
		tone?: Tone;
	}

	let { label, value, tone = 'neutral' }: Props = $props();

	const VALUE_CLASS: Record<Tone, string> = {
		neutral: 'text-ink',
		secured: 'text-secured',
		shortfall: 'text-shortfall-strong',
		blocked: 'text-blocked'
	};

	/*
	 * 숫자 굴림 (2026-10-23, 5-18·8-2 F). 값이 바뀌면 이전 값에서 새 값으로 300ms 굴러간다.
	 * - 입력칸에 글자를 넣는 중에는 굴리지 않고 바로 바꾼다 (입력 흐름을 건드리지 않는다)
	 * - 다른 화면에서 옮겨 와 결과가 나타날 때는 0에서 굴러 올라온다. 처음 들어온 화면은 서버가 그린 값 그대로
	 * - 굴리는 건 숫자 하나뿐인 값만 ("1,718", "82.6%", "214연"). 숫자가 둘 이상이거나(날짜 등) 앞뒤 글자가 바뀌면 바로 바꾼다
	 * - 자릿수가 흔들리지 않게 tabular-nums. 굴리는 동안의 글자는 화면 낭독기가 읽지 않는다 (aria-hidden + 숨은 최종값)
	 */
	const NUMBER = /-?\d[\d,]*(?:\.\d+)?/g;

	interface Parts {
		pre: string;
		post: string;
		n: number;
		decimals: number;
		grouped: boolean;
	}

	function split(v: string): Parts | null {
		const found = v.match(NUMBER);
		if (!found || found.length !== 1) return null;
		const raw = found[0];
		const at = v.indexOf(raw);
		return {
			pre: v.slice(0, at),
			post: v.slice(at + raw.length),
			n: Number(raw.replaceAll(',', '')),
			decimals: raw.split('.')[1]?.length ?? 0,
			grouped: raw.includes(',')
		};
	}

	const tween = new Tween(0, { duration: MOTION.roll, easing: cubicOut });
	let rolling = $state(false);
	let shape = $state<Parts | null>(null);
	let last = untrack(() => value);

	function format(n: number, p: Parts): string {
		return (
			p.pre +
			n.toLocaleString('ko-KR', {
				minimumFractionDigits: p.decimals,
				maximumFractionDigits: p.decimals,
				useGrouping: p.grouped
			}) +
			p.post
		);
	}

	function roll(fromN: number, to: Parts, delay = 0) {
		shape = to;
		rolling = true;
		tween.set(fromN, { duration: 0 });
		tween.set(to.n, { delay }).then(() => {
			if (tween.target === to.n) rolling = false;
		});
	}

	onMount(() => {
		const p = split(value);
		if (p && isClientArrival() && !reducedMotion() && !isTyping()) roll(0, p, MOTION.arrival);
	});

	$effect(() => {
		const next = value;
		untrack(() => {
			if (next === last) return;
			const from = split(last);
			const to = split(next);
			last = next;
			if (
				!from ||
				!to ||
				from.pre !== to.pre ||
				from.post !== to.post ||
				reducedMotion() ||
				isTyping()
			) {
				rolling = false;
				return;
			}
			roll(rolling ? tween.current : from.n, { ...to, grouped: to.grouped || from.grouped });
		});
	});

	const shown = $derived(rolling && shape ? format(tween.current, shape) : value);
</script>

<!--
	숫자 크기는 화면 폭이 아니라 칸 폭을 따른다 (2026-10-23, 컨테이너 쿼리): 넓은 칸 22px, 보통 20px, 좁은 칸 18px.
	수급 결과처럼 세 칸이 한 줄에 놓이면 칸이 90px 안팎까지 좁아져 "1,718"이 "1,71 / 8"로 끊겼다.
	숫자는 줄을 바꾸지 않는다 (whitespace-nowrap)
-->
<div
	class="@container rounded-xl bg-wash group-data-tinted/plate:bg-surface/86 group-data-tinted/plate:shadow-[inset_0_1px_0_#fff,0_0_0_1px_rgb(42_66_91/0.08)]"
>
	<div class="p-3 @min-[8rem]:p-4">
		<div
			class="font-num text-lg font-bold whitespace-nowrap tabular-nums @min-[6.5rem]:text-xl @min-[9rem]:text-[1.375rem] {VALUE_CLASS[
				tone
			]}"
		>
			{#if rolling}
				<span aria-hidden="true">{shown}</span><span class="sr-only">{value}</span>
			{:else}
				{value}
			{/if}
		</div>
		<div class="mt-1 text-xs text-navy">{label}</div>
	</div>
</div>
