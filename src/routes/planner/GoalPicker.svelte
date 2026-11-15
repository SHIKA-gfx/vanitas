<!--
	목표 종류 고르기 — 내 목표 줄 안 (docs/007 10-3, 2026-11-15).

	- 확정 / 반천장 / N연. 목표마다 다르다. 확정이 기본이고, 저장·공유 값에는 확정을 적지 않는다
	- 모양: SegmentedField(기울인 홈, 5-19)의 작은 판 — 줄 안에 SegmentedField(조각 36px·라벨 줄)는 커서 조각 28px·글자 12px.
	  모서리는 같은 단계(홈 3px 8px, 조각 2px 4px, 5-14). 고른 쪽만 흰 조각이 떠오르고 brand-strong 굵은 글자 (색만이 아니라 면·굵기로도 구분한다)
	- N연을 고르면 옆에 연 수 칸 (1 ~ 천장 − 1). 입력 중에는 범위 안의 값만 바로 반영하고,
	  칸을 벗어날 때 빈칸·범위 밖을 범위 끝으로 고친다 (NumberField는 0부터라 빈칸을 0으로 두지만 여기는 1부터)
	- 다른 종류로 바꿨다가 N연으로 돌아오면 마지막 연 수를 다시 쓴다
-->
<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import type { PlannerGoal, PlannerGoalKind } from '$lib/calc/planner';

	interface Props {
		/** 학생 이름 — 화면 낭독기가 어느 목표의 종류인지 알게 */
		name: string;
		goal: PlannerGoal;
		kinds: readonly PlannerGoalKind[];
		maxPulls: number;
		defaultPulls: number;
		onchange: (goal: PlannerGoal) => void;
	}

	let { name, goal, kinds, maxPulls, defaultPulls, onchange }: Props = $props();
	const id = $props.id();

	const LABEL: Record<PlannerGoalKind, () => string> = {
		pity: m.planner_goal_pity,
		half: m.planner_goal_half,
		pulls: m.planner_goal_pulls
	};

	/** 마지막으로 정한 N (다른 종류로 바꿔도 기억한다) */
	let lastPulls = $state(0);
	const pulls = $derived(goal.kind === 'pulls' ? goal.pulls : lastPulls || defaultPulls);

	function pick(kind: PlannerGoalKind) {
		if (kind === goal.kind) return;
		if (goal.kind === 'pulls') lastPulls = goal.pulls;
		onchange(kind === 'pulls' ? { kind, pulls } : { kind });
	}

	/** 입력 중인 글자 (칸에 초점이 있을 때만) */
	let text = $state<string | null>(null);
	const inRange = (n: number) => Number.isInteger(n) && n >= 1 && n <= maxPulls;

	function onInput(e: Event & { currentTarget: HTMLInputElement }) {
		text = e.currentTarget.value.replace(/\D/g, '');
		const n = Number(text);
		if (text !== '' && inRange(n) && n !== pulls) onchange({ kind: 'pulls', pulls: n });
	}

	function onBlur() {
		if (text !== null && text !== '') {
			const n = Math.min(maxPulls, Math.max(1, Number(text)));
			if (n !== pulls) onchange({ kind: 'pulls', pulls: n });
		}
		text = null;
	}
</script>

<fieldset class="flex flex-wrap items-center gap-x-2 gap-y-1.5">
	<legend class="sr-only">{m.planner_goal_label({ name })}</legend>
	<div
		class="mx-2 flex -skew-x-30 gap-1 rounded-[3px_8px] border border-navy/12 bg-slot p-1 shadow-[inset_0_1px_2px_rgb(42_66_91/0.1)]"
	>
		{#each kinds as kind (kind)}
			<label>
				<input
					type="radio"
					name={id}
					value={kind}
					checked={goal.kind === kind}
					onchange={() => pick(kind)}
					class="peer sr-only"
				/>
				<span
					class="flex min-h-7 min-w-11 cursor-pointer items-center justify-center rounded-[2px_4px] px-2 text-xs text-navy transition-colors peer-checked:bg-surface peer-checked:font-bold peer-checked:text-brand-strong peer-checked:shadow-[inset_0_1px_0_#fff,0_1px_2px_rgb(42_66_91/0.12)] peer-focus-visible:outline-2 peer-focus-visible:outline-brand-strong hover:text-ink"
				>
					<span class="inline-block skew-x-30">{LABEL[kind]()}</span>
				</span>
			</label>
		{/each}
	</div>
	{#if goal.kind === 'pulls'}
		<span class="flex items-center gap-1 text-xs text-navy">
			<input
				id="{id}-pulls"
				type="text"
				inputmode="numeric"
				autocomplete="off"
				aria-label={m.planner_goal_pulls_input({ name })}
				aria-describedby="{id}-range"
				value={text ?? String(pulls)}
				oninput={onInput}
				onfocus={() => (text = String(pulls))}
				onblur={onBlur}
				onkeydown={(e) => {
					if (e.key === 'Enter') e.currentTarget.blur();
				}}
				class="h-8 w-14 rounded-md border border-navy/15 bg-slot px-2 text-right font-num text-sm text-ink shadow-[inset_0_1px_2px_rgb(42_66_91/0.1)] focus:bg-surface focus-visible:outline-2 focus-visible:outline-brand-strong"
			/>
			<span aria-hidden="true">{m.field_unit_pulls()}</span>
			<span id="{id}-range" class="sr-only">{m.planner_goal_pulls_range({ max: maxPulls })}</span>
		</span>
	{/if}
</fieldset>
