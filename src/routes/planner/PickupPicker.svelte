<!--
	예정 픽업 목록 — 기간마다 픽업 학생을 눌러 목표로 고른다 (2026-10-24 결정).
	누르기 단추는 aria-pressed로 상태를 알린다. 가칭 학생은 "가칭" + 일본 공식 이름 (docs/005 4-1)

	화면 다시 그리기 (2026-10-25, 디자인 문서 5-20)
	- 30일 페이지: 오늘부터 30일씩 나눈다 (달력 월이 아니라 "지금부터 N개월"과 맞게). 기간은 시작일이 속한 페이지에.
	  페이지 수는 미래시 데이터에 맞춰 늘어난다. 넘겨도 고른 목표는 그대로이고, 페이지마다 고른 수를 함께 보여준다
	- 기간 타일: 판 위에 기간마다 타일을 올리고, 바탕은 분홍(blush)·회청(sky-muted)을 번갈아 쓴다.
	  파랑 계열은 "확보" 판정 색이라 피했다 (5-18). 색만으로 나누지 않도록 타일 사이 간격과 날짜 탭이 함께 있다
	- 페이지를 넘기면 넘긴 방향으로 200ms 미끄러진다 (상태 변화, 원칙 6). 줄인 움직임이면 바로 바뀐다
-->
<script lang="ts">
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { m } from '$lib/paraglide/messages.js';
	import { formatDate, formatInt, formatMonthDay } from '$lib/format';
	import { addDays, daysBetween } from '$lib/game-date';
	import { reducedMotion } from '$lib/motion';
	import Badge from '$lib/components/Badge.svelte';
	import type { PlannerChoicePeriod } from '$lib/calc/planner-adapter';
	import { targetKey, type TargetKey } from './target-key';

	interface Props {
		periods: PlannerChoicePeriod[];
		selected: TargetKey[];
		ontoggle: (key: TargetKey) => void;
		/** 게임 날짜 기준 오늘 — 페이지의 시작 */
		today: string;
	}

	let { periods, selected, ontoggle, today }: Props = $props();

	const PAGE_DAYS = 30;
	const STEPS: (1 | -1)[] = [-1, 1];

	/** 타일 바탕: 분홍과 회청을 번갈아. 기간마다 색이 고정되도록 전체 순서로 정한다 */
	const TINTS = ['bg-blush/20', 'bg-sky-muted/20'] as const;

	const pageOf = (start: string) => Math.max(0, Math.floor(daysBetween(today, start) / PAGE_DAYS));

	const pages = $derived.by(() => {
		const count = periods.length === 0 ? 1 : pageOf(periods[periods.length - 1].recruit.start) + 1;
		return Array.from({ length: count }, (_, i) => ({
			from: addDays(today, i * PAGE_DAYS),
			to: addDays(today, i * PAGE_DAYS + PAGE_DAYS - 1),
			periods: periods
				.map((p, order) => ({ ...p, order }))
				.filter((p) => pageOf(p.recruit.start) === i)
		}));
	});

	let page = $state(0);
	/** 넘긴 방향 — 새 페이지가 그쪽에서 들어온다 */
	let direction = $state<1 | -1>(1);
	const current = $derived(pages[Math.min(page, pages.length - 1)]);

	const pickedIn = (p: { periods: { recruit: { id: string } }[] }) =>
		selected.filter((key) => p.periods.some((q) => key.startsWith(`${q.recruit.id}~`))).length;

	function go(by: 1 | -1) {
		const next = page + by;
		if (next < 0 || next >= pages.length) return;
		direction = by;
		page = next;
	}
</script>

<!-- 페이지 머리: 지금 보는 30일 + 그 안에서 고른 수, 오른쪽에 넘기기 단추 -->
<div class="mb-4 flex items-center justify-between gap-3">
	<p class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm" aria-live="polite">
		<span class="font-num font-bold text-ink">
			{m.planner_page_range({ from: formatMonthDay(current.from), to: formatMonthDay(current.to) })}
		</span>
		{#if pickedIn(current) > 0}
			<span class="font-num text-navy"
				>{m.planner_page_picked({ count: formatInt(pickedIn(current)) })}</span
			>
		{/if}
	</p>
	<div class="flex shrink-0 items-center gap-1.5">
		{#each STEPS as by (by)}
			<button
				type="button"
				onclick={() => go(by)}
				disabled={by === -1 ? page === 0 : page >= pages.length - 1}
				aria-label={by === -1 ? m.planner_page_prev() : m.planner_page_next()}
				class="mx-1 inline-flex h-9 w-11 -skew-x-30 items-center justify-center rounded-[3px_8px] border border-navy/25 bg-surface/70 text-navy shadow-[inset_0_1px_0_#fff] transition-colors hover:border-navy/45 hover:bg-surface hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-strong disabled:opacity-35"
			>
				<svg
					aria-hidden="true"
					viewBox="0 0 16 16"
					class="size-4 skew-x-30"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d={by === -1 ? 'M10 3 5 8l5 5' : 'm6 3 5 5-5 5'} />
				</svg>
			</button>
		{/each}
		<span class="sr-only">{formatInt(page + 1)} / {formatInt(pages.length)}</span>
	</div>
</div>

{#key page}
	<div
		in:fly={{
			x: reducedMotion() ? 0 : direction * 24,
			duration: reducedMotion() ? 0 : 200,
			easing: cubicOut
		}}
	>
		{#if current.periods.length === 0}
			<p class="text-sm text-navy">{m.planner_page_empty()}</p>
		{:else}
			<!-- 타일 사이 20px: 날짜 탭이 타일 위로 10px 솟는다 -->
			<ol class="flex flex-col gap-5 pt-2.5">
				{#each current.periods as { recruit, choices, order, offPickup } (recruit.id)}
					<li class="relative rounded-xl px-3 pt-5 pb-3 {TINTS[order % TINTS.length]}">
						<span
							class="absolute -top-2.5 left-3 h-5 -skew-x-30 rounded-[2px_4px] bg-navy px-2.5 text-[0.6875rem] leading-5 font-bold text-white"
						>
							<span class="inline-block skew-x-30 font-num">{formatDate(recruit.start)}</span>
						</span>
						{#if recruit.status === 'estimated' || recruit.event || recruit.freePulls}
							<div class="mb-2 flex flex-wrap items-center gap-2 text-sm">
								{#if recruit.status === 'estimated'}<Badge>{m.planner_estimated()}</Badge>{/if}
								{#if recruit.event}<span class="text-navy">{recruit.event}</span>{/if}
								{#if recruit.freePulls}
									<span class="font-num text-navy"
										>{m.planner_free_pulls({ count: recruit.freePulls })}</span
									>
								{/if}
							</div>
						{/if}
						<ul class="grid grid-cols-2 gap-2 md:flex md:flex-wrap">
							{#each choices as c (c.studentId)}
								{@const key = targetKey(c.recruitId, c.studentId)}
								{@const on = selected.includes(key)}
								<li class="min-w-0">
									<button
										type="button"
										aria-pressed={on}
										onclick={() => ontoggle(key)}
										class="flex min-h-11 w-full flex-col items-start justify-center rounded-lg border px-3 py-1.5 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong md:w-auto {on
											? 'border-brand-strong bg-brand-strong text-white shadow-[0_6px_14px_-6px_rgb(10_111_214/0.8)]'
											: 'border-white bg-surface/90 text-ink shadow-[0_1px_2px_rgb(42_66_91/0.08),0_4px_10px_-6px_rgb(18_136_248/0.35)] hover:border-brand-strong'}"
									>
										<span class="flex items-center gap-1.5">
											{c.student.name.ko}
											{#if c.student.koNameStatus === 'provisional'}
												<span class="text-xs {on ? 'text-white' : 'text-navy'}"
													>{m.planner_provisional()}</span
												>
											{/if}
										</span>
										<span class="text-xs {on ? 'text-white' : 'text-navy'}">
											{c.stack
												.name}{#if c.student.koNameStatus === 'provisional' && c.student.name.ja}
												· {c.student.name.ja}{/if}
										</span>
									</button>
								</li>
							{/each}
						</ul>
						{#if offPickup.length > 0}
							<!-- 픽업 외 모집 가능 (페스 복각 등): 스택 200은 픽업 대상만 확정하므로 고르기 단추가 아니다 -->
							<div class="mt-3 text-xs leading-relaxed text-navy">
								<p class="font-bold text-ink">{m.planner_off_pickup_title()}</p>
								<p>{offPickup.map((s) => s.name.ko).join(', ')}</p>
								<p>{m.planner_off_pickup_note()}</p>
							</div>
						{/if}
					</li>
				{/each}
			</ol>
		{/if}
	</div>
{/key}
