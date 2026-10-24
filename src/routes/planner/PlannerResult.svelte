<!--
	플래너 결과판 (Panel e2) — 요약 한 줄 + 내 목표(우선순위) + 대안 + 안내.
	판정 색 (2026-10-24 결정, 디자인 문서 5-18): 전원 확보 → 확보, 한 명이라도 부족·불가 → 부족, 목표 없음 → 색 없음.
	판정 규칙은 planner.ts에 있다 — 여기서 조건을 새로 만들지 않는다.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { m } from '$lib/paraglide/messages.js';
	import { formatDate, formatInt, formatPercent } from '$lib/format';
	import Panel, { type PanelTone } from '$lib/components/Panel.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import type { PlannerChoicePeriod, PlannerOutcome } from '$lib/calc/planner-adapter';
	import { parseTargetKey, type TargetKey } from './target-key';

	interface Props {
		outcome: PlannerOutcome;
		targets: TargetKey[];
		periods: PlannerChoicePeriod[];
		onmove: (index: number, by: -1 | 1) => void;
		onremove: (index: number) => void;
		actions?: Snippet;
	}

	let { outcome, targets, periods, onmove, onremove, actions }: Props = $props();

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

		<!-- 내 목표: 우선순위 순. 위/아래 단추로 순서를 바꾼다 (모바일 우선, 끌기 없음) -->
		<h3 class="mt-5 mb-2 text-sm text-navy">{m.planner_section_targets()}</h3>
		<ol class="flex flex-col gap-2">
			{#each r.outcomes as o, i (targets[i])}
				{@const { period, choice } = choiceOf(targets[i])}
				{@const name = choice?.student.name.ko ?? nameOf(o.id)}
				<li class="flex items-center gap-2 rounded-lg bg-surface/70 px-3 py-2">
					<span class="w-6 shrink-0 text-center text-sm text-navy">{i + 1}</span>
					<div class="min-w-0 flex-1">
						<div class="flex flex-wrap items-center gap-x-2 gap-y-1">
							<span class="font-bold text-ink">{name}</span>
							{#if choice?.student.koNameStatus === 'provisional'}
								<span class="text-xs text-navy">
									{m.planner_provisional()}{#if choice.student.name.ja}
										· {choice.student.name.ja}{/if}
								</span>
							{/if}
							{#if o.kind === 'secured'}
								<Badge tone="secured">{m.planner_badge_secured()}</Badge>
							{:else if o.kind === 'short'}
								<Badge tone="shortfall">{m.planner_badge_short()}</Badge>
							{:else}
								<Badge>{m.planner_badge_unavailable()}</Badge>
							{/if}
						</div>
						<p class="text-xs text-navy">
							{#if period}{formatDate(period.recruit.start)} · {choice?.stack.name}{/if}
							{#if o.kind === 'short'}
								· <span class="text-ink"
									>{m.planner_target_short({ gems: formatInt(o.shortfallGems) })}</span
								>
							{:else if o.kind === 'unavailable'}
								{o.reason === 'period_ended'
									? m.planner_target_ended()
									: m.planner_target_unknown()}
							{/if}
						</p>
						{#if o.kind !== 'unavailable' && o.probabilityBeforePity !== null}
							<p class="text-xs text-navy">
								{m.planner_target_before_pity({
									probability: formatPercent(o.probabilityBeforePity)
								})}
								· {m.planner_target_stack({
									name: choice?.stack.name ?? '',
									stack: formatInt(o.stackStart)
								})}
							</p>
						{/if}
					</div>
					<!-- 순서 단추는 세로로 쌓아 글자 칸을 넓게 둔다. 빼기는 맨 아래 -->
					<div class="flex shrink-0 flex-col items-center self-stretch">
						<button
							type="button"
							class="grid h-9 w-11 place-items-center text-navy hover:text-ink disabled:opacity-30"
							aria-label={m.planner_move_up({ name })}
							disabled={i === 0}
							onclick={() => onmove(i, -1)}>▲</button
						>
						<button
							type="button"
							class="grid h-9 w-11 place-items-center text-navy hover:text-ink disabled:opacity-30"
							aria-label={m.planner_move_down({ name })}
							disabled={i === r.outcomes.length - 1}
							onclick={() => onmove(i, 1)}>▼</button
						>
						<button
							type="button"
							class="grid h-9 w-11 place-items-center text-sm text-navy hover:text-ink"
							aria-label={m.planner_remove({ name })}
							onclick={() => onremove(i)}>✕</button
						>
					</div>
				</li>
			{/each}
		</ol>

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

		<!-- 안내: 판의 아래쪽(흰 쪽)에 둔다 (디자인 문서 10장) -->
		<div class="mt-5 flex flex-col gap-1 text-xs leading-relaxed text-navy">
			<p>{m.planner_note_worst_case()}</p>
			{#if outcome.scheduleEstimated}
				<p>{m.planner_note_schedule({ date: formatDate(outcome.scheduleVerifiedAt) })}</p>
			{/if}
			{#if outcome.mileageAssumed}<p>{m.planner_note_mileage()}</p>{/if}
			{#if outcome.freePullsIgnored.length > 0}<p>{m.planner_note_free_pulls()}</p>{/if}
		</div>
	{/if}

	{#if actions}
		<div class="mt-4 flex justify-end">{@render actions()}</div>
	{/if}
</Panel>
