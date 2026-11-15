<!--
	플래너 결과판 (Panel e2) — 요약 한 줄 + 내 목표(우선순위) + 대안 + 안내.
	판정 색 (2026-10-24 결정, 디자인 문서 5-18): 전원 확보 → 확보, 한 명이라도 부족·불가 → 부족, 목표 없음 → 색 없음.
	목표 종류 (2026-11-15, docs/007 10-3): 파랑은 모든 목표가 확보일 때만. 부족·불가 없이 도전 목표가 섞이면 색 없음 + "도전".
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
	import type { PlannerGoal, TargetOutcome } from '$lib/calc/planner';
	import { parseTargetKey, type TargetKey } from './target-key';
	import { goalOf, type GoalValues } from './goal';

	interface Props {
		outcome: PlannerOutcome;
		targets: TargetKey[];
		goals: GoalValues;
		periods: PlannerChoicePeriod[];
		onreorder: (from: number, to: number) => void;
		onremove: (index: number) => void;
		ongoal: (index: number, goal: PlannerGoal) => void;
		maxPulls: number;
		defaultPulls: number;
		actions?: Snippet;
	}

	let {
		outcome,
		targets,
		goals,
		periods,
		onreorder,
		onremove,
		ongoal,
		maxPulls,
		defaultPulls,
		actions
	}: Props = $props();

	const choiceOf = (key: TargetKey) => {
		const { recruitId, studentId } = parseTargetKey(key);
		const period = periods.find((p) => p.recruit.id === recruitId);
		return { period, choice: period?.choices.find((c) => c.studentId === studentId), studentId };
	};
	const nameOf = (studentId: string) =>
		periods.flatMap((p) => p.choices).find((c) => c.studentId === studentId)?.student.name.ko ??
		studentId;

	const result = $derived(outcome.kind === 'ok' ? outcome.result : null);
	const isProblem = (o: TargetOutcome) => o.kind === 'short' || o.kind === 'unavailable';
	/** 첫 번째로 계획에 못 든 목표 (부족·불가). 없으면 -1 */
	const firstShort = $derived(result ? result.outcomes.findIndex(isProblem) : -1);
	/** 판정: 모두 확보 / 부족·불가가 있음 / 부족 없이 도전이 섞임 */
	const verdict = $derived(
		!result || result.outcomes.length === 0
			? null
			: firstShort !== -1
				? 'shortfall'
				: result.attemptCount > 0
					? 'attempt'
					: 'secured'
	);
	/** 확률 목표(반천장·N연)를 하나라도 골랐는가 — 계산 기준에 한 줄 더한다 */
	const anyGoal = $derived(targets.some((k) => goalOf(goals[k], maxPulls).kind !== 'pity'));
	/** 대안으로 늘어나는 목표 중 도전(천장까지 닿지 않는) 목표가 있는가 */
	const gainsAttempt = (ids: string[]) =>
		ids.some((id) => {
			const o = result?.outcomes.find((x) => x.id === id);
			return o !== undefined && o.kind !== 'unavailable' && !o.guaranteed;
		});
	/** 내 목표 줄에 보여줄 값 (TargetList) — 계산 결과와 고른 학생 정보를 한 줄로 묶는다 */
	const items = $derived<TargetItem[]>(
		(result?.outcomes ?? []).map((o, i) => {
			const { period, choice } = choiceOf(targets[i]);
			const goal = goalOf(goals[targets[i]], maxPulls);
			return {
				key: targets[i],
				name: choice?.student.name.ko ?? nameOf(o.id),
				provisional: choice?.student.koNameStatus === 'provisional',
				ja: choice?.student.name.ja,
				kind: o.kind,
				shortfallGems: o.kind === 'short' ? o.shortfallGems : undefined,
				reason: o.kind === 'unavailable' ? o.reason : undefined,
				start: period?.recruit.start,
				stackName: choice?.stack.name,
				probability: o.kind !== 'unavailable' ? o.probabilityBeforePity : null,
				stackStart: o.kind !== 'unavailable' ? o.stackStart : undefined,
				goal: choice?.goalKinds.includes(goal.kind) ? goal : { kind: 'pity' },
				goalKinds: choice?.goalKinds,
				goalLock: choice?.goalLock,
				pulls: o.kind !== 'unavailable' ? o.pulls : undefined,
				goalProbability: o.kind !== 'unavailable' ? o.probability : null,
				guaranteed: o.kind !== 'unavailable' ? o.guaranteed : undefined,
				rateVerified: choice?.rateVerified
			};
		})
	);

	const tone: PanelTone = $derived(
		verdict === 'secured' ? 'secured' : verdict === 'shortfall' ? 'shortfall' : 'neutral'
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
			{#if verdict === 'secured'}
				<Badge tone="secured">{m.planner_badge_secured()}</Badge>
			{:else if verdict === 'shortfall'}
				<Badge tone="shortfall">{m.planner_badge_short()}</Badge>
			{:else}
				<Badge>{m.planner_badge_attempt()}</Badge>
			{/if}
			{#if r.attemptCount === 0}
				{m.planner_summary({
					total: formatInt(r.outcomes.length),
					secured: formatInt(r.securedCount)
				})}
			{:else if r.securedCount === 0}
				{m.planner_summary_attempt_only({
					total: formatInt(r.outcomes.length),
					attempt: formatInt(r.attemptCount)
				})}
			{:else}
				{m.planner_summary_mixed({
					total: formatInt(r.outcomes.length),
					secured: formatInt(r.securedCount),
					attempt: formatInt(r.attemptCount)
				})}
			{/if}
		</p>
		<p class="mt-1 text-ink">
			{#if verdict === 'secured'}
				{m.planner_summary_all()}
			{:else if verdict === 'attempt'}
				{m.planner_summary_all_planned()}
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
						: o.reason === 'half_passed'
							? m.planner_target_half_passed()
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
		<TargetList {items} {onreorder} {onremove} {ongoal} {maxPulls} {defaultPulls} />

		{#if r.alternatives.length > 0}
			<h3 class="mt-5 mb-2 text-sm text-navy">{m.planner_alternative_title()}</h3>
			<ul class="flex flex-col gap-1 text-sm text-ink">
				{#each r.alternatives as alt (alt.plannedIds.join())}
					{@const words = {
						dropped: alt.droppedIds.map(nameOf).join(', ') || '-',
						gained: alt.gainedIds.map(nameOf).join(', ')
					}}
					<li>
						{gainsAttempt(alt.gainedIds)
							? m.planner_alternative_planned(words)
							: m.planner_alternative(words)}
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
					{#if anyGoal}<p>{m.planner_note_goal()}</p>{/if}
					{#if outcome.mileageAssumed}<p>{m.planner_note_mileage()}</p>{/if}
					{#if outcome.freePullsIgnored.length > 0}<p>{m.planner_note_free_pulls()}</p>{/if}
					{#if outcome.result.periods.some((p) => p.freePulls > 0)}
						<p>{m.planner_note_free_pulls_counted()}</p>
					{/if}
				</div>
			</details>
		</div>
	{/if}

	{#if actions}
		<div class="mt-4 flex justify-end">{@render actions()}</div>
	{/if}
</Panel>
