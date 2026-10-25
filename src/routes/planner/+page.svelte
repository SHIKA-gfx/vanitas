<!--
	/ko/planner — 픽업 플래너 (docs/005)
	질문: 고른 학생들을 지금 재화와 앞으로의 수급으로, 우선순위대로 몇 명까지 확정으로 데려올 수 있나

	모바일 (2026-10-25, 디자인 문서 5-20 P3): 제목 아래 화면 안 탭 [고르기 | 계획 | 재화] — 한 번에 한 묶음만.
	  고르기 = 예정 픽업 + 탭바 위 결과 한 줄 띠(누르면 계획 탭), 계획 = 결과판(내 목표) + 계획 판, 재화 = 보유 재화 입력칸.
	  탭은 CSS로만 숨긴다(max-md:hidden) — 넓은 화면은 언제나 전부 보이고, 서버가 그린 화면과 어긋나지 않는다.
	  탭 상태는 저장·공유하지 않는다. 공유 링크로 열면 계획 탭부터
	데스크톱 (2026-10-25 다시 그림, 디자인 문서 5-20): 왼쪽 보유 재화(접힌 요약) + 예정 픽업(30일 페이지),
	오른쪽 결과판 + 계획(기간별 계획 | 잔고 곡선 전환). 목표: 1280×800에서 스크롤 없이 재화·고르기·답이 보인다

	결정 (2026-10-24)
	- 목표는 예정 픽업 목록에서 학생을 눌러 고른다. 새 목표는 우선순위 맨 아래
	- 결과판 색: 전원 확보면 확보(파랑), 한 명이라도 부족·불가면 부족(주황), 목표가 없으면 색 없음
	- 수급 조건은 수급 계산기의 저장값을 그대로 읽는다 (income-settings.ts). 플래너에서는 바꾸지 않는다
	- 공유 링크에는 보낸 사람의 수급 조건이 실린다 (2026-10-25). 받은 사람이 "이 값으로 저장"하면 수급 계산기 값도 바뀐다
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
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
	import SegmentedField from '$lib/components/SegmentedField.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import { getSavedStore } from '$lib/state/saved.svelte';
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

	/*
	 * 보유 재화는 한 줄 요약으로 접어 둔다. 처음 쓰는 사람(값이 모두 0)에게는 펼쳐 보여준다.
	 * 저장값은 persistSection의 onMount에서 먼저 불러오므로, 그 뒤에 판단한다
	 */
	let inputsOpen = $state(false);
	const inputsId = $props.id();
	const noResources = () =>
		res.gems === 0 &&
		res.singleTickets === 0 &&
		res.tenPullTickets === 0 &&
		Object.values(res.stackByType).every((v) => !v) &&
		res.mileage === 0;
	onMount(() => {
		if (noResources()) inputsOpen = true;
	});

	// ---------------- 모바일 화면 안 탭 (5-20 P3) ----------------
	let mobileTab = $state<'pick' | 'plan' | 'inputs'>('pick');
	/** 모바일에서 지금 탭이 아니면 숨긴다 (넓은 화면은 그대로) */
	const onTab = (tab: typeof mobileTab) => (mobileTab === tab ? '' : 'max-md:hidden');
	onMount(() => {
		if (getSavedStore().sharedView) mobileTab = 'plan';
	});

	/** 고르기 탭 아래 결과 한 줄 띠: 목표 수·확보 수·첫 번째로 모자란 목표의 부족 청휘석 */
	const strip = $derived.by(() => {
		if (outcome.kind !== 'ok' || outcome.result.outcomes.length === 0) return null;
		const r = outcome.result;
		const first = r.outcomes.findIndex((o) => o.kind !== 'secured');
		const total = formatInt(r.outcomes.length);
		if (first === -1) return { tone: 'secured' as const, text: m.planner_strip_all({ total }) };
		const o = r.outcomes[first];
		const head = m.planner_strip({ total, secured: formatInt(r.securedCount) });
		return {
			tone: 'shortfall' as const,
			text:
				o.kind === 'short'
					? `${head} · ${m.planner_strip_short({ gems: formatInt(o.shortfallGems) })}`
					: head
		};
	});

	function openPlan() {
		mobileTab = 'plan';
		window.scrollTo({ top: 0 });
	}

	/** 오른쪽 아래 계획 판: 기간별 계획과 잔고 곡선을 한 판에서 바꿔 본다 (높이를 반으로) */
	let planView = $state<'periods' | 'balance'>('periods');

	function toggle(key: TargetKey) {
		targets = targets.includes(key) ? targets.filter((k) => k !== key) : [...targets, key];
	}
	/** 우선순위 바꾸기: from 자리의 목표를 to 자리로 (끌기·▲▼ 모두). 저장 형식은 그대로 — 배열 순서가 우선순위 */
	function reorder(from: number, to: number) {
		if (from === to || from < 0 || to < 0 || from >= targets.length || to >= targets.length) return;
		const next = [...targets];
		const [key] = next.splice(from, 1);
		next.splice(to, 0, key);
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

	<!-- 모바일 화면 안 탭: 넓은 화면에서는 두 열이 다 보이므로 숨긴다 -->
	<div class="md:hidden">
		<SegmentedField
			label={m.planner_tabs_label()}
			labelHidden
			bind:value={mobileTab}
			options={[
				{ value: 'pick', label: m.planner_tab_pick() },
				{ value: 'plan', label: m.planner_tab_plan() },
				{ value: 'inputs', label: m.planner_tab_inputs() }
			]}
		/>
	</div>

	<!-- 오른쪽 열: 답 (결과판 → 기간별 계획 → 잔고) -->
	<div class="flex flex-col gap-6 md:col-start-2 md:row-span-2 md:row-start-2 {onTab('plan')}">
		<PlannerResult {outcome} {targets} {periods} onreorder={reorder} onremove={remove}>
			{#snippet actions()}<ShareButton url={saved.shareUrl} />{/snippet}
		</PlannerResult>

		{#if outcome.kind === 'ok' && outcome.result.outcomes.length > 0}
			<Panel title={m.planner_section_plan()}>
				<div class="flex flex-col gap-4">
					{#if outcome.result.periods.length > 0}
						<SegmentedField
							label={m.planner_plan_view()}
							bind:value={planView}
							options={[
								{ value: 'periods', label: m.planner_section_periods() },
								{ value: 'balance', label: m.planner_view_balance() }
							]}
						/>
					{/if}
					{#if planView === 'balance' && outcome.result.periods.length > 0}
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
					{:else}
						<PeriodPlan {outcome} {periods} />
					{/if}
				</div>
			</Panel>
		{/if}
	</div>

	<!-- 왼쪽 열: 보유 재화(접힌 요약) → 예정 픽업(30일 페이지) -->
	<div
		class="flex flex-col gap-6 md:col-start-1 md:row-start-2 {mobileTab === 'pick' && strip
			? 'max-md:mb-16'
			: ''}"
	>
		<Panel title={m.planner_section_inputs()} class={onTab('inputs')}>
			<!-- 요약 한 줄: 누르면 입력칸이 펼쳐진다. 값을 바꾸는 곳은 그대로 이 판 하나 -->
			<button
				type="button"
				aria-expanded={inputsOpen}
				aria-controls={inputsId}
				onclick={() => (inputsOpen = !inputsOpen)}
				class="-m-1 flex w-[calc(100%+0.5rem)] items-center justify-between gap-3 rounded-lg p-1 text-left focus-visible:outline-2 focus-visible:outline-brand-strong max-md:hidden"
			>
				<span class="flex flex-wrap gap-1.5 font-num text-sm text-ink">
					<span class="rounded-md bg-wash px-2 py-1"
						>{m.planner_inputs_gems({ count: formatInt(res.gems) })}</span
					>
					<span class="rounded-md bg-wash px-2 py-1"
						>{m.planner_inputs_single({ count: formatInt(res.singleTickets) })}</span
					>
					<span class="rounded-md bg-wash px-2 py-1"
						>{m.planner_inputs_ten({ count: formatInt(res.tenPullTickets) })}</span
					>
					{#each chargeSystem.chargeTypes as stack (stack.id)}
						<span class="rounded-md bg-wash px-2 py-1"
							>{stack.name} {formatInt(res.stackByType[stack.id] ?? 0)}</span
						>
					{/each}
					{#if res.mileage > 0}
						<span class="rounded-md bg-wash px-2 py-1"
							>{m.planner_inputs_mileage({ count: formatInt(res.mileage) })}</span
						>
					{/if}
					{#if reserveGems > 0}
						<span class="rounded-md bg-wash px-2 py-1"
							>{m.planner_inputs_reserve({ count: formatInt(reserveGems) })}</span
						>
					{/if}
				</span>
				<span class="sr-only"
					>{inputsOpen ? m.planner_inputs_collapse() : m.planner_inputs_expand()}</span
				>
				<svg
					aria-hidden="true"
					viewBox="0 0 16 16"
					class="size-4 shrink-0 text-navy transition-transform {inputsOpen ? 'rotate-180' : ''}"
					fill="none"
					stroke="currentColor"
					stroke-width="1.8"
					stroke-linecap="round"
					stroke-linejoin="round"><path d="M4 6l4 4 4-4" /></svg
				>
			</button>
			<!-- 모바일 "재화" 탭에서는 요약 없이 늘 펼친다. 넓은 화면은 요약을 눌러 펼친다 -->
			<div id={inputsId} class="md:mt-5 {inputsOpen ? '' : 'md:hidden'}">
				<div class="flex flex-col gap-4">
					<NumberField
						label={m.pity_input_gems()}
						unit={m.field_unit_gems()}
						bind:value={res.gems}
					/>
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
			</div>
		</Panel>

		<Panel title={m.planner_section_pick()} class={onTab('pick')}>
			<PickupPicker {periods} selected={targets} ontoggle={toggle} {today} />
		</Panel>
	</div>

	<!-- 고르기 탭의 결과 한 줄 띠: 탭바 바로 위에 붙어, 고르는 동안 답이 보인다. 누르면 계획 탭으로 -->
	{#if strip && mobileTab === 'pick'}
		<button
			type="button"
			onclick={openPlan}
			class="fixed inset-x-2.5 bottom-(--tabbar-space) z-[9] flex min-h-12 items-center gap-2 rounded-xl border border-white bg-surface/96 px-3 py-2 text-left shadow-e1 focus-visible:outline-2 focus-visible:outline-brand-strong md:hidden"
		>
			<Badge tone={strip.tone}
				>{strip.tone === 'secured' ? m.planner_badge_secured() : m.planner_badge_short()}</Badge
			>
			{#key strip.text}
				<span
					in:fade={{ duration: 150 }}
					class="min-w-0 flex-1 truncate font-num text-sm font-bold text-ink">{strip.text}</span
				>
			{/key}
			<span class="shrink-0 text-xs text-navy">{m.planner_strip_open()} ›</span>
		</button>
	{/if}
</main>
