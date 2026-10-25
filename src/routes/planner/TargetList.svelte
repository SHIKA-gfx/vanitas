<!--
	내 목표 — 우선순위 순 목록 (디자인 문서 5-20 P2, 2026-10-25).

	- 순위: navy 평행사변형 태그 + 흰 숫자. 줄 바탕은 순위가 높을수록 진한 navy 농도 (1순위 12% → 아래로 옅게, 최소 4%).
	  파랑이 아니라 navy인 까닭: 파랑은 "확보" 판정 색이다 (5-18). 확보·부족은 줄 안의 배지가 말한다
	- 순서 바꾸기 (사용자 결정): 줄 왼쪽 손잡이(⠿)를 끌어서. 마우스·펜은 바로, 터치는 손잡이를 250ms 누른 뒤.
	  끄는 동안 다른 줄이 비켜난다 (상태 변화). 놓기 전까지 목표 순서·계산은 바뀌지 않는다
	- 한 번 누르기 대안과 키보드: ▲▼ (WCAG 2.2 2.5.7). 끌기 손잡이는 마우스·터치 전용이라 초점을 받지 않는다
	- 옮기면 "이름, N순위"를 화면 낭독기에 알린다. 새 목표는 아래에서 들어오고, 빼면 사라진다
	- 화면 가장자리에서 끌면 아주 조금씩만 스크롤한다 (스크롤을 가로채지 않는다)
-->
<script lang="ts" module>
	export interface TargetItem {
		key: string;
		name: string;
		provisional: boolean;
		ja?: string | null;
		kind: 'secured' | 'short' | 'unavailable';
		shortfallGems?: number;
		ended?: boolean;
		start?: string;
		stackName?: string;
		probability?: number | null;
		stackStart?: number;
	}
</script>

<script lang="ts">
	import { tick } from 'svelte';
	import { flip } from 'svelte/animate';
	import { fly, fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { m } from '$lib/paraglide/messages.js';
	import { formatInt, formatMonthDay, formatPercent } from '$lib/format';
	import { reducedMotion } from '$lib/motion';
	import Badge from '$lib/components/Badge.svelte';

	interface Props {
		items: TargetItem[];
		onreorder: (from: number, to: number) => void;
		onremove: (index: number) => void;
	}

	let { items, onreorder, onremove }: Props = $props();

	/** 순위별 바탕 (Tailwind가 찾도록 통째로). 왼쪽이 진하고 오른쪽으로 절반쯤 옅어진다 */
	const TINT = [
		'from-navy/12 to-navy/6',
		'from-navy/10 to-navy/5',
		'from-navy/8 to-navy/4',
		'from-navy/6 to-navy/3',
		'from-navy/5 to-navy/2',
		'from-navy/4 to-navy/2'
	];
	const tintOf = (i: number) => TINT[Math.min(i, TINT.length - 1)];

	// ---------------- 끌기 ----------------
	const HOLD_MS = 250;
	const SLOP = 8;
	const EDGE = 48;

	let listEl = $state<HTMLOListElement>();
	let dragFrom = $state(-1);
	let dragTo = $state(-1);
	let dragDy = $state(0);
	let dragH = $state(0);
	/** 놓는 순간: 줄이 이미 제자리에 그려져 있으므로 순서 바뀜을 다시 움직이지 않는다 */
	let dropping = $state(false);

	let rects: { top: number; height: number }[] = [];
	let startY = 0;
	let gap = 0;
	let holdTimer: ReturnType<typeof setTimeout> | undefined;
	let pending: { index: number; y: number; id: number } | null = null;

	const pageY = (e: PointerEvent) => e.clientY + window.scrollY;

	function measure() {
		const rows = listEl ? [...listEl.children] : [];
		rects = rows.map((r) => {
			const b = r.getBoundingClientRect();
			return { top: b.top + window.scrollY, height: b.height };
		});
		gap = rects.length > 1 ? rects[1].top - (rects[0].top + rects[0].height) : 0;
	}

	function begin(index: number, y: number) {
		measure();
		dragFrom = index;
		dragTo = index;
		dragH = rects[index].height + gap;
		startY = y;
		dragDy = 0;
	}

	function onPointerDown(e: PointerEvent, index: number) {
		if (e.button !== 0 || items.length < 2) return;
		const handle = e.currentTarget as HTMLElement;
		handle.setPointerCapture(e.pointerId);
		if (e.pointerType === 'mouse' || e.pointerType === 'pen') {
			e.preventDefault();
			begin(index, pageY(e));
			return;
		}
		// 터치: 잠깐 누르고 있어야 시작한다 (바로 시작하면 세로 스크롤과 다툰다)
		pending = { index, y: pageY(e), id: e.pointerId };
		holdTimer = setTimeout(() => {
			if (pending) begin(pending.index, pending.y);
			pending = null;
		}, HOLD_MS);
	}

	function onPointerMove(e: PointerEvent) {
		if (pending) {
			if (Math.abs(pageY(e) - pending.y) > SLOP) cancelHold();
			return;
		}
		if (dragFrom < 0) return;
		if (e.clientY > window.innerHeight - EDGE) window.scrollBy(0, 6);
		else if (e.clientY < EDGE) window.scrollBy(0, -6);
		dragDy = pageY(e) - startY;
		const center = rects[dragFrom].top + rects[dragFrom].height / 2 + dragDy;
		let to = 0;
		for (let i = 0; i < rects.length; i++) {
			if (i === dragFrom) continue;
			if (center > rects[i].top + rects[i].height / 2) to += 1;
		}
		dragTo = to;
	}

	async function onPointerUp() {
		cancelHold();
		if (dragFrom < 0) return;
		const from = dragFrom;
		const to = dragTo;
		dropping = true;
		dragFrom = -1;
		dragTo = -1;
		dragDy = 0;
		if (from !== to) {
			onreorder(from, to);
			announce(to);
		}
		await tick();
		dropping = false;
	}

	function cancelHold() {
		clearTimeout(holdTimer);
		pending = null;
	}

	/** 끄는 동안 다른 줄이 비켜나는 거리 */
	function shiftOf(i: number): number {
		if (dragFrom < 0 || i === dragFrom) return 0;
		if (dragFrom < dragTo && i > dragFrom && i <= dragTo) return -dragH;
		if (dragTo < dragFrom && i >= dragTo && i < dragFrom) return dragH;
		return 0;
	}

	// ---------------- ▲▼ ----------------
	let message = $state('');
	function announce(rank: number) {
		const item = items[rank];
		if (item) message = m.planner_moved({ name: item.name, rank: formatInt(rank + 1) });
	}
	async function move(i: number, by: -1 | 1) {
		const to = i + by;
		if (to < 0 || to >= items.length) return;
		onreorder(i, to);
		await tick();
		announce(to);
	}

	const quick = () => (reducedMotion() ? 0 : 1);
</script>

<ol bind:this={listEl} class="flex flex-col gap-2 {dragFrom >= 0 ? 'select-none' : ''}">
	{#each items as item, i (item.key)}
		{@const dragging = i === dragFrom}
		<li
			animate:flip={{ duration: dropping ? 0 : 200 * quick(), easing: cubicOut }}
			in:fly={{ y: 10, duration: 220 * quick(), easing: cubicOut }}
			out:fade={{ duration: 120 * quick() }}
			style:transform={dragging
				? `translateY(${dragDy}px) scale(1.02)`
				: shiftOf(i)
					? `translateY(${shiftOf(i)}px)`
					: undefined}
			class="relative flex items-center gap-2 rounded-lg bg-surface/85 bg-linear-to-r py-2 pr-1 pl-1 {tintOf(
				i
			)} {dragging
				? 'z-10 shadow-e2'
				: dragFrom >= 0
					? 'transition-transform duration-150 ease-out'
					: ''}"
		>
			<!-- 끌기 손잡이: 마우스·터치 전용 (키보드·한 번 누르기는 ▲▼) -->
			<div
				aria-hidden="true"
				onpointerdown={(e) => onPointerDown(e, i)}
				onpointermove={onPointerMove}
				onpointerup={onPointerUp}
				onpointercancel={onPointerUp}
				class="flex h-11 w-6 shrink-0 cursor-grab touch-none items-center justify-center text-navy/55 select-none [-webkit-touch-callout:none] hover:text-navy {dragging
					? 'cursor-grabbing'
					: ''}"
			>
				<svg viewBox="0 0 8 14" class="h-3.5 w-2" fill="currentColor">
					<circle cx="2" cy="2" r="1.2" /><circle cx="6" cy="2" r="1.2" />
					<circle cx="2" cy="7" r="1.2" /><circle cx="6" cy="7" r="1.2" />
					<circle cx="2" cy="12" r="1.2" /><circle cx="6" cy="12" r="1.2" />
				</svg>
			</div>

			<!-- 순위 태그: 제목 탭과 같은 navy 평행사변형 -->
			<span
				class="inline-flex h-6 min-w-8 shrink-0 -skew-x-30 items-center justify-center rounded-[2px_4px] bg-navy px-2 text-sm font-bold text-white"
			>
				<span aria-hidden="true" class="inline-block skew-x-30 font-num">{i + 1}</span>
				<span class="sr-only">{m.planner_rank({ rank: formatInt(i + 1) })}</span>
			</span>

			<div class="min-w-0 flex-1">
				<div class="flex items-center gap-2">
					<div class="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
						<span class="font-bold text-ink">{item.name}</span>
						{#if item.provisional}
							<span class="text-xs text-navy">
								{m.planner_provisional()}{#if item.ja}· {item.ja}{/if}
							</span>
						{/if}
						{#if item.kind === 'secured'}
							<Badge tone="secured">{m.planner_badge_secured()}</Badge>
						{:else if item.kind === 'short'}
							<Badge tone="shortfall">{m.planner_badge_short()}</Badge>
						{:else}
							<Badge>{m.planner_badge_unavailable()}</Badge>
						{/if}
					</div>
					<!-- 한 번 누르기: 올리기·내리기·빼기를 이름 줄 오른쪽에 가로로 — 아래 두 줄이 판 폭을 다 쓴다 (예전엔 세로로 쌓아 한 줄이 108px) -->
					<div class="flex shrink-0 items-center">
						<button
							type="button"
							class="grid h-9 w-8 place-items-center text-navy hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-strong disabled:opacity-30"
							aria-label={m.planner_move_up({ name: item.name })}
							disabled={i === 0}
							onclick={() => move(i, -1)}>▲</button
						>
						<button
							type="button"
							class="grid h-9 w-8 place-items-center text-navy hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-strong disabled:opacity-30"
							aria-label={m.planner_move_down({ name: item.name })}
							disabled={i === items.length - 1}
							onclick={() => move(i, 1)}>▼</button
						>
						<button
							type="button"
							class="grid h-9 w-8 place-items-center text-sm text-navy hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-strong"
							aria-label={m.planner_remove({ name: item.name })}
							onclick={() => onremove(i)}>✕</button
						>
					</div>
				</div>
				<p class="text-xs text-navy">
					{#if item.start}{formatMonthDay(item.start)} · {item.stackName}{/if}
					{#if item.kind === 'short' && item.shortfallGems !== undefined}
						· <span class="text-ink"
							>{m.planner_target_short({ gems: formatInt(item.shortfallGems) })}</span
						>
					{:else if item.kind === 'unavailable'}
						{item.ended ? m.planner_target_ended() : m.planner_target_unknown()}
					{/if}
				</p>
				{#if item.kind !== 'unavailable' && item.probability != null}
					<p class="text-xs text-navy">
						{m.planner_target_before_pity({ probability: formatPercent(item.probability) })}
						· {m.planner_target_stack({
							name: item.stackName ?? '',
							stack: formatInt(item.stackStart ?? 0)
						})}
					</p>
				{/if}
			</div>
		</li>
	{/each}
</ol>
<p class="sr-only" aria-live="polite">{message}</p>
