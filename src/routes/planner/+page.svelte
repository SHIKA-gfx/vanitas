<!--
	/ko/planner — 픽업 플래너 (docs/005)
	질문: 고른 학생들을 지금 재화와 앞으로의 수급으로, 우선순위대로 몇 명까지 확정으로 데려올 수 있나

	모바일: 결과판(요약 + 내 목표) → 기간별 계획 → 예정 픽업(고르기) → 보유 재화 → 잔고 곡선
	데스크톱: 왼쪽 예정 픽업 + 보유 재화, 오른쪽 결과판 + 기간별 계획 + 잔고 곡선

	결정 (2026-10-24)
	- 목표는 예정 픽업 목록에서 학생을 눌러 고른다. 새 목표는 우선순위 맨 아래
	- 결과판 색: 전원 확보면 확보(파랑), 한 명이라도 부족·불가면 부족(주황), 목표가 없으면 색 없음
	- 수급 조건은 수급 계산기의 저장값을 그대로 읽는다 (income-settings.ts). 플래너에서는 바꾸지 않는다
	- 공유 링크에는 보낸 사람의 수급 조건이 실린다 (2026-10-25). 받은 사람이 "이 값으로 저장"하면 수급 계산기 값도 바뀐다
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Pathname } from '$app/types';
	import Seo from '$lib/components/Seo.svelte';
	import { m } from '$lib/paraglide/messages.js';
	import { localizeHref } from '$lib/paraglide/runtime.js';
	import { getApConfig, getGameConfig, listIncomePresets, listRecruits } from '$lib/data';
	import { formatInt } from '$lib/format';
	import { gameToday } from '$lib/game-date';
	import { listPlannerChoices, planFromData } from '$lib/calc/planner-adapter';
	import Panel from '$lib/components/Panel.svelte';
	import NumberField from '$lib/components/NumberField.svelte';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import ResetButton from '$lib/components/ResetButton.svelte';
	import ShareButton from '$lib/components/ShareButton.svelte';
	import { getUserState } from '$lib/state/user-state.svelte';
	import { persistSection } from '$lib/state/saved.svelte';
	import { isInt, isSubsetOf } from '$lib/state/persist';
	import {
		INCOME_SECTION,
		INCOME_SHARE_FIELDS,
		incomeChecks,
		incomeDefaults,
		toIncomeInput,
		type IncomeSettings
	} from '$lib/state/income-settings';
	import BalanceCurve from '../income/BalanceCurve.svelte';
	import PlannerResult from './PlannerResult.svelte';
	import PeriodPlan from './PeriodPlan.svelte';
	import PickupPicker from './PickupPicker.svelte';
	import { parseTargetKey, targetKey, type TargetKey } from './target-key';

	const ap = getApConfig();
	const today = gameToday(new Date(), ap.purchase.resetTime, ap.purchase.resetTimezone);
	const chargeSystem = getGameConfig().chargeSystem;
	const stackMax = chargeSystem.hardPity.count - 1;

	/** 고를 수 있는 목표 (오늘 이후에 끝나는 기간) */
	const periods = listPlannerChoices(today);
	/** 저장값으로 허용하는 목표 — 끝난 기간도 포함해 "기간이 끝났어요"로 보여준다 */
	const allKeys = listRecruits().flatMap((r) =>
		r.banners.flatMap((b) => b.students.map((s) => targetKey(r.id, s)))
	);

	let targets = $state<TargetKey[]>([]);
	let reserveGems = $state(0);

	// 수급 조건: 수급 계산기가 저장한 값 (income-settings.ts). 플래너에서는 고치지 않는다
	let income = $state<IncomeSettings>(incomeDefaults(today));

	const saved = persistSection(
		'planner',
		() => ({ targets, reserveGems }),
		(v) => {
			targets = v.targets;
			reserveGems = v.reserveGems;
		},
		() => ({ targets: [] as TargetKey[], reserveGems: 0 }),
		{ targets: isSubsetOf(allKeys), reserveGems: isInt(0) },
		// 공유 링크: 목표(우선순위 순) + 보유 재화 + 보낸 사람의 수급 조건 (2026-10-25 결정).
		// 수급 조건은 수급 계산기와 같은 짧은 이름을 쓰고, 종료 날짜(d)는 싣지 않는다
		{
			fields: [
				{ key: 'targets', param: 'tg', kind: 'list' },
				{ key: 'reserveGems', param: 'rs', kind: 'int' }
			],
			user: [
				'gems',
				'singleTickets',
				'tenPullTickets',
				'stackByType',
				'mileage',
				'apPurchasesPerDay'
			],
			linked: {
				name: INCOME_SECTION,
				fields: INCOME_SHARE_FIELDS.filter((f) => f.key !== 'endDate'),
				defaults: () => incomeDefaults(today),
				checks: incomeChecks(today),
				get: () => income,
				set: (v) => {
					income = v as IncomeSettings;
				},
				keepMine: ['endDate']
			}
		}
	);

	const user = getUserState();
	const res = user.resources;

	const presetLabel = $derived(
		listIncomePresets().find((p) => p.id === income.preset)?.label ?? ''
	);

	const outcome = $derived(
		planFromData({
			today,
			targets: targets.map(parseTargetKey),
			gems: res.gems,
			singleTickets: res.singleTickets,
			tenPullTickets: res.tenPullTickets,
			stacks: res.stackByType,
			mileage: res.mileage,
			reserveGems,
			income: toIncomeInput(income, user.habits.apPurchasesPerDay)
		})
	);

	function toggle(key: TargetKey) {
		targets = targets.includes(key) ? targets.filter((k) => k !== key) : [...targets, key];
	}
	function move(index: number, by: -1 | 1) {
		const next = [...targets];
		const to = index + by;
		if (to < 0 || to >= next.length) return;
		[next[index], next[to]] = [next[to], next[index]];
		targets = next;
	}
	function remove(index: number) {
		targets = targets.filter((_, i) => i !== index);
	}
</script>

<Seo
	title={`${m.planner_page_title()} | ${m.app_title()}`}
	description={m.meta_planner_description()}
/>

<main class="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 md:grid md:grid-cols-2 md:gap-6">
	<PageTitle title={m.planner_page_title()} icon="planner" class="md:col-span-2">
		{#snippet actions()}<ResetButton onreset={saved.reset} />{/snippet}
	</PageTitle>

	<!-- 오른쪽 열: 답 (결과판 → 기간별 계획 → 잔고) -->
	<div class="flex flex-col gap-6 md:col-start-2 md:row-span-2 md:row-start-2">
		<PlannerResult {outcome} {targets} {periods} onmove={move} onremove={remove}>
			{#snippet actions()}<ShareButton url={saved.shareUrl} />{/snippet}
		</PlannerResult>

		{#if outcome.kind === 'ok' && outcome.result.outcomes.length > 0}
			<Panel title={m.planner_section_periods()}>
				<PeriodPlan {outcome} {periods} />
			</Panel>
			{#if outcome.result.periods.length > 0}
				<Panel title={m.planner_section_balance()}>
					<BalanceCurve
						{today}
						records={outcome.result.balance.map((balance, day) => ({
							day,
							income: 0,
							spend: 0,
							tickets: 0,
							balance
						}))}
					/>
				</Panel>
			{/if}
		{/if}
	</div>

	<!-- 왼쪽 열: 고르기와 입력 -->
	<div class="flex flex-col gap-6 md:col-start-1 md:row-start-2">
		<Panel title={m.planner_section_pick()}>
			<PickupPicker {periods} selected={targets} ontoggle={toggle} />
		</Panel>

		<Panel title={m.planner_section_inputs()}>
			<div class="flex flex-col gap-4">
				<NumberField label={m.pity_input_gems()} unit={m.field_unit_gems()} bind:value={res.gems} />
				<div class="grid grid-cols-2 gap-4">
					<NumberField
						label={m.pity_input_single_tickets()}
						unit={m.field_unit_tickets()}
						bind:value={res.singleTickets}
					/>
					<NumberField
						label={m.pity_input_ten_tickets()}
						unit={m.field_unit_tickets()}
						bind:value={res.tenPullTickets}
					/>
				</div>
				<!-- 스택은 천장·확률 계산기와 같은 공유 값 -->
				<div class="grid grid-cols-2 gap-4">
					{#each chargeSystem.chargeTypes as stack (stack.id)}
						<NumberField
							label={stack.name}
							max={stackMax}
							bind:value={
								() => res.stackByType[stack.id] ?? 0,
								(v) => {
									res.stackByType[stack.id] = v;
								}
							}
						/>
					{/each}
				</div>
				<NumberField
					label={m.pity_input_mileage()}
					hint={m.pity_input_mileage_hint()}
					bind:value={res.mileage}
				/>

				<!-- 수급 조건 요약: 바꾸는 곳은 수급 계산기 하나 -->
				<div class="flex flex-wrap items-center justify-between gap-2 text-sm">
					<span class="font-num text-navy">
						{m.planner_income_summary({
							preset: presetLabel,
							perDay: outcome.kind === 'ok' ? formatInt(outcome.incomePerDay) : '-'
						})}
					</span>
					<a
						href={resolve(localizeHref('/income') as Pathname)}
						class="text-ink underline underline-offset-4 hover:text-brand-strong"
					>
						{m.planner_income_edit()}
					</a>
				</div>

				<details class="group rounded-lg bg-wash/60">
					<summary
						class="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 text-sm text-navy hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-strong"
					>
						<span>{m.planner_reserve_toggle()}</span>
						<span class="flex items-center gap-2 font-num tabular-nums">
							{#if reserveGems > 0}<span class="text-ink">{formatInt(reserveGems)}</span>{/if}
							<span aria-hidden="true" class="transition-transform group-open:rotate-180">▾</span>
						</span>
					</summary>
					<div class="px-3 pb-3">
						<NumberField
							label={m.planner_input_reserve()}
							unit={m.field_unit_gems()}
							hint={m.planner_input_reserve_hint()}
							bind:value={reserveGems}
						/>
					</div>
				</details>
			</div>
		</Panel>
	</div>
</main>
