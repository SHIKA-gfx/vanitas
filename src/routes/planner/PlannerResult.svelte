<!--
	플래너 결과판 (Panel e2) — 요약 한 줄 + 내 목표(우선순위) + 대안 + 안내.
	판정 색 (2026-10-24 결정, 디자인 문서 5-18): 전원 확보 → 확보, 한 명이라도 부족·불가 → 부족, 목표 없음 → 색 없음.
	판정 규칙은 planner.ts에 있다 — 여기서 조건을 새로 만들지 않는다.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { m } from '$lib/paraglide/messages.js';
	import { formatDate, formatInt } from '$lib/format';
	import Panel, { type PanelTone } from '$lib/components/Panel.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import TargetList, { type TargetItem } from './TargetList.svelte';
	import type { PlannerChoicePeriod, PlannerOutcome } from '$lib/calc/planner-adapter';
	import { parseTargetKey, type TargetKey } from './target-key';

	interface Props {
		outcome: PlannerOutcome;
		targets: TargetKey[];
		periods: PlannerChoicePeriod[];
		onreorder: (from: number, to: number) => void;
		onremove: (index: number) => void;
		actions?: Snippet;
	}

	let { outcome, targets, periods, onreorder, onremove, actions }: Props = $props();

	const choiceOf = (key: TargetKey) => {
		const { recruitId, studentId } = parseTargetKey(key);
		const period = periods.find((p) => p.recruit.id === recruitId);
		return { period, choice: period?.choices.find((c) => c.studentId === studentId), studentId };
	};
	const nameOf = (studentId: string) =>
		periods.flatMap((p) => p.choices).find((c) => c.studentId === studentId)?.student.name.ko ??
		studentId;

	const result = $derived(outcome.kind === 'ok' ? outcome.result : null);
	const firstShort = $derived(result ? result.outcomes.findIndex((o) => o.kind !== 'secured') : -1);
	/** 내 목표 줄에 보여줄 값 (TargetList) — 계산 결과와 고른 학생 정보를 한 줄로 묶는다 */
	const items = $derived<TargetItem[]>(
		(result?.outcomes ?? []).map((o, i) => {
			const { period, choice } = choiceOf(targets[i]);
			return {
				key: targets[i],
				name: choice?.student.name.ko ?? nameOf(o.id),
				provisional: choice?.student.koNameStatus === 'provisional',
				ja: choice?.student.name.ja,
				kind: o.kind,
				shortfallGems: o.kind === 'short' ? o.shortfallGems : undefined,
				ended: o.kind === 'unavailable' ? o.reason === 'period_ended' : undefined,
				start: period?.recruit.start,
				stackName: choice?.stack.name,
				probability: o.kind !== 'unavailable' ? o.probabilityBeforePity : null,
				stackStart: o.kind !== 'unavailable' ? o.stackStart : undefined
			};
		})
	);

	const tone: PanelTone = $derived(
		!result || result.outcomes.length === 0
			? 'neutral'
			: firstShort === -1
				? 'secured'
				: 'shortfall'
	);
</script>

<Panel
	pulse={result?.outcomes}
	marks
	elevation="e2"
	{tone}
	class="font-num [view-transition-name:vt-result-planner]"
>
	{#if outcome.kind === 'invalid_income'}
		<p class="text-lg font-bold text-ink">{m.planner_invalid_income()}</p>
	{:else if outcome.kind === 'no_recruits'}
		<p class="text-lg font-bold text-ink">{m.planner_no_recruits()}</p>
	{:else if outcome.result.outcomes.length === 0}
		<p class="text-lg font-bold text-ink">{m.planner_summary_empty()}</p>
	{:else}
		{@const r = outcome.result}
		<!-- 요약: 판정 배지 + 문장 (색만으로 구분하지 않는다, 디자인 문서 2-4) -->
		<p
			class="flex flex-wrap items-center gap-2 text-[1.375rem] leading-snug font-bold text-ink md:text-2xl"
		>
			<Badge tone={firstShort === -1 ? 'secured' : 'shortfall'}>
				{firstShort === -1 ? m.planner_badge_secured() : m.planner_badge_short()}
			</Badge>
			{m.planner_summary({
				total: formatInt(r.outcomes.length),
				secured: formatInt(r.securedCount)
			})}
		</p>
		<p class="mt-1 text-ink">
			{#if firstShort === -1}
				{m.planner_summary_all()}
			{:else}
				{@const o = r.outcomes[firstShort]}
				{#if o.kind === 'short'}
					{m.planner_summary_first_short({
						rank: formatInt(firstShort + 1),
						name: nameOf(o.id),
						gems: formatInt(o.shortfallGems)
					})}
				{:else if o.kind === 'unavailable'}
					{m.planner_rank({ rank: formatInt(firstShort + 1) })}
					{nameOf(o.id)} — {o.reason === 'period_ended'
						? m.planner_target_ended()
						: m.planner_target_unknown()}
				{/if}
			{/if}
		</p>

		<!-- 내 목표: 우선순위 순 (TargetList — 순위 태그·농도, 끌기 + ▲▼). 제목에 개수 -->
		<h3 class="mt-5 mb-2 flex items-center gap-2 text-sm text-navy">
			{m.planner_section_targets()}
			<span
				class="inline-flex h-5 min-w-6 items-center justify-center rounded-full bg-navy px-1.5 font-num text-xs font-bold text-white"
				>{formatInt(items.length)}</span
			>
		</h3>
		<TargetList {items} {onreorder} {onremove} />

		{#if r.alternatives.length > 0}
			<h3 class="mt-5 mb-2 text-sm text-navy">{m.planner_alternative_title()}</h3>
			<ul class="flex flex-col gap-1 text-sm text-ink">
				{#each r.alternatives as alt (alt.securedIds.join())}
					<li>
						{m.planner_alternative({
							dropped: alt.droppedIds.map(nameOf).join(', ') || '-',
							gained: alt.gainedIds.map(nameOf).join(', ')
						})}
					</li>
				{/each}
			</ul>
		{/if}

		<!--
			안내: 판의 아래쪽(흰 쪽)에 둔다 (디자인 문서 10장).
			2026-10-25 (5-20): 결과판 높이를 줄이려고 계산 기준은 접어 둔다. 미래시가 추정이라는 안내만 늘 보인다
		-->
		<div class="mt-5 flex flex-col gap-2 text-xs leading-relaxed text-navy">
			{#if outcome.scheduleEstimated}
				<p>{m.planner_note_schedule({ date: formatDate(outcome.scheduleVerifiedAt) })}</p>
			{/if}
			<details class="group">
				<summary
					class="inline-flex min-h-8 cursor-pointer list-none items-center gap-1.5 text-navy hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-strong"
				>
					{m.planner_note_toggle()}
					<span aria-hidden="true" class="transition-transform group-open:rotate-180">▾</span>
				</summary>
				<div class="mt-1 flex flex-col gap-1">
					<p>{m.planner_note_worst_case()}</p>
					{#if outcome.mileageAssumed}<p>{m.planner_note_mileage()}</p>{/if}
					{#if outcome.freePullsIgnored.length > 0}<p>{m.planner_note_free_pulls()}</p>{/if}
				</div>
			</details>
		</div>
	{/if}

	{#if actions}
		<div class="mt-4 flex justify-end">{@render actions()}</div>
	{/if}
</Panel>
