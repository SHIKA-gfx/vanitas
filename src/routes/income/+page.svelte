<!--
	/ko/income — 청휘석 수급 계산기
	모바일: 결과 → 입력 → 막대·곡선 (다른 계산기와 같은 배치, 디자인 문서 5-6)
	데스크톱: 왼쪽 입력, 오른쪽 결과 + 막대·곡선
-->
<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { getApConfig, getIncomeSources, listIncomePresets } from '$lib/data';
	import { calculateIncome, listToggleableSources, presetIncluded } from '$lib/calc/income-adapter';
	import { apPurchaseCostPerDay } from '$lib/calc/levelup-adapter';
	import { addDays, gameToday } from '$lib/game-date';
	import { formatInt } from '$lib/format';
	import { getUserState } from '$lib/state/user-state.svelte';
	import Panel from '$lib/components/Panel.svelte';
	import NumberField from '$lib/components/NumberField.svelte';
	import SelectField from '$lib/components/SelectField.svelte';
	import SegmentedField from '$lib/components/SegmentedField.svelte';
	import CheckboxField from '$lib/components/CheckboxField.svelte';
	import DateField from '$lib/components/DateField.svelte';
	import IncomeResult from './IncomeResult.svelte';
	import SourceBars from './SourceBars.svelte';
	import BalanceCurve from './BalanceCurve.svelte';

	const ap = getApConfig();
	const data = getIncomeSources();
	const today = gameToday(new Date(), ap.purchase.resetTime, ap.purchase.resetTimezone);

	// 보유 재화와 하루 AP 구매 횟수는 다른 계산기와 함께 쓴다 (UserState)
	const user = getUserState();
	const res = user.resources;
	const habits = user.habits;

	// ---------------------------------------------------------------- 선택지

	const presets = listIncomePresets();
	const presetOptions = presets.map((p) => ({ value: p.id, label: p.label }));
	const toggleable = listToggleableSources();

	const tactical = data.sources.find((s) => s.id === 'tactical-tournament');
	const raidRank = data.sources.find((s) => s.tiers);
	const tierOptions = (raidRank?.tiers ?? []).map((t) => ({ value: t.id, label: t.label }));
	const eventSource = data.sources.find((s) => s.period === 'perEvent');
	const participationOptions = data.eventParticipation.map((p) => ({
		value: p.id,
		label: p.label
	}));

	const SUBSCRIPTION_MAX_COUNT = 6;
	const subscriptionOptions = (durationDays: number) => [
		{ value: '0', label: m.income_subscription_none() },
		...Array.from({ length: SUBSCRIPTION_MAX_COUNT }, (_, i) => ({
			value: String(i + 1),
			label: m.income_subscription_count({
				count: String(i + 1),
				days: m.unit_days({ count: formatInt((i + 1) * durationDays) })
			})
		})),
		{ value: 'continuous', label: m.income_subscription_continuous() }
	];

	// 하루 AP 구매 횟수 도움말은 레벨업 계산기와 같은 문구 (같은 UserState 값)
	const purchaseHelp = m.levelup_help_purchases({
		ap: formatInt(ap.purchase.apPerPurchase),
		max: formatInt(ap.purchase.maxPurchasesPerDay),
		tiers: ap.purchase.priceTiers
			.map((t) =>
				m.levelup_purchase_tier({
					from: String(t.fromCount),
					to: String(t.toCount),
					price: formatInt(t.price)
				})
			)
			.join(', '),
		reset: ap.purchase.resetTime
	});

	// ---------------------------------------------------------------- 입력 상태

	let endDate = $state(addDays(today, 90));
	let preset = $state(presets[0]?.id ?? 'full');
	// 프리셋을 고르면 포함 목록이 그 프리셋으로 바뀌고, 그 뒤 체크로 고칠 수 있다
	let included = $state(presetIncluded(presets[0]?.id ?? 'full'));
	let tacticalDaily = $state(tactical?.amount ?? 0);
	let raidTier = $state(raidRank?.tiers?.[0]?.id ?? '');
	let participation = $state(data.eventParticipation[0]?.id ?? '');
	let subscriptions = $state<Record<string, string>>(
		Object.fromEntries(data.subscriptions.map((p) => [p.id, '0']))
	);

	function selectPreset(id: string) {
		preset = id;
		included = presetIncluded(id);
	}

	function setIncluded(id: string, on: boolean) {
		included = on ? [...included, id] : included.filter((x) => x !== id);
	}

	const result = $derived(
		calculateIncome({
			today,
			endDate,
			gems: res.gems,
			singleTickets: res.singleTickets,
			tenPullTickets: res.tenPullTickets,
			included,
			tacticalDaily,
			raidTier,
			participation,
			subscriptions: Object.fromEntries(
				Object.entries(subscriptions).map(([id, v]) => [
					id,
					v === 'continuous' ? 'continuous' : Number(v)
				])
			),
			apPurchasesPerDay: habits.apPurchasesPerDay
		})
	);

	// 결과 아래 패널: 수급원별 막대 / 잔고 추이 중 하나를 골라 본다
	const viewOptions = [
		{ value: 'bars', label: m.income_bars_title() },
		{ value: 'curve', label: m.income_curve_title() }
	];
	let view = $state('bars');

	// 입력 오류는 결과 카드와 함께 해당 칸에도 보여준다 (디자인 문서 5-8)
	const endDateError = $derived(
		result.kind === 'invalid' && result.field === 'endDate'
			? m.income_invalid_end_date()
			: undefined
	);

	const purchaseCost = $derived(apPurchaseCostPerDay(habits.apPurchasesPerDay));
</script>

<svelte:head>
	<title>{m.income_page_title()} | {m.app_title()}</title>
</svelte:head>

<!--
	배치 (2026-09-30)
	- 모바일: 결과 → 지금 가진 재화 → 받는 청휘석 → 쓰는 청휘석 → 막대·곡선 (order로 순서)
	- md(2칸): 왼쪽 입력 세 패널 / 오른쪽 결과 + 막대·곡선
	- xl(3칸): 지금 가진 재화 + 쓰는 청휘석 | 받는 청휘석 | 결과 + 막대·곡선
	  세 열을 같은 행에 두고 각 열의 마지막 패널을 늘여서, 열 바닥이 나란히 맞고 패널 사이 간격은 어디서나 같다.
	  (열마다 따로 쌓지 않고 행을 공유하면, 옆 열이 긴 만큼 패널 사이가 벌어진다)
-->
<main
	class="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6 md:grid md:grid-cols-2 md:gap-6 xl:max-w-7xl xl:grid-cols-3"
>
	<h1 class="text-[1.75rem] font-bold text-ink md:col-span-2 xl:col-span-3">
		{m.income_page_title()}
	</h1>

	<!-- 결과 열 -->
	<div class="contents xl:col-start-3 xl:row-start-2 xl:flex xl:flex-col xl:gap-6">
		<div class="order-1 md:order-none md:col-start-2 md:row-start-2">
			<IncomeResult {result} hasHoldings={res.gems + res.singleTickets + res.tenPullTickets > 0} />
		</div>
		{#if result.kind === 'ok'}
			<div
				class="order-3 md:order-none md:col-start-2 md:row-start-3 xl:flex xl:flex-1 xl:flex-col"
			>
				<Panel class="xl:flex-1">
					<div class="flex flex-col gap-4">
						{#if result.records.length > 1}
							<SegmentedField
								label={m.income_view_label()}
								bind:value={view}
								options={viewOptions}
							/>
						{/if}
						{#if view === 'curve' && result.records.length > 1}
							<BalanceCurve records={result.records} />
						{:else}
							<SourceBars sources={result.sources} />
						{/if}
					</div>
				</Panel>
			</div>
		{/if}
	</div>

	<!-- 입력 열 (xl에서는 두 열로 나뉜다) -->
	<div
		class="order-2 flex flex-col gap-4 md:order-none md:col-start-1 md:row-span-3 md:row-start-2 md:gap-6 xl:contents"
	>
		<div class="contents xl:col-start-1 xl:row-start-2 xl:flex xl:flex-col xl:gap-6">
			<div class="order-1 xl:order-none">
				<Panel title={m.income_section_state()}>
					<div class="flex flex-col gap-4">
						<NumberField label={m.pity_input_gems()} bind:value={res.gems} />
						<div class="grid grid-cols-2 gap-4">
							<NumberField label={m.pity_input_single_tickets()} bind:value={res.singleTickets} />
							<NumberField label={m.pity_input_ten_tickets()} bind:value={res.tenPullTickets} />
						</div>
						<DateField
							label={m.income_input_end_date()}
							bind:value={endDate}
							min={addDays(today, 1)}
							error={endDateError}
						/>
					</div>
				</Panel>
			</div>
			<div class="order-3 xl:order-none xl:flex xl:flex-1 xl:flex-col">
				<Panel title={m.income_section_spend()} class="xl:flex-1">
					<NumberField
						label={m.levelup_input_purchases()}
						bind:value={habits.apPurchasesPerDay}
						max={ap.purchase.maxPurchasesPerDay}
						help={purchaseHelp}
						hint={purchaseCost
							? m.levelup_purchases_hint({ gems: formatInt(purchaseCost) })
							: undefined}
					/>
				</Panel>
			</div>
		</div>

		<div class="order-2 xl:order-none xl:col-start-2 xl:row-start-2 xl:flex xl:flex-col">
			<Panel title={m.income_section_income()} class="xl:flex-1">
				<div class="flex flex-col gap-4">
					<SegmentedField
						label={m.income_input_preset()}
						bind:value={() => preset, selectPreset}
						options={presetOptions}
					/>

					<fieldset>
						<legend class="text-sm text-navy">{m.income_input_sources()}</legend>
						<div class="grid grid-cols-2 gap-x-4">
							{#each toggleable as source (source.id)}
								<CheckboxField
									label={source.name}
									bind:checked={
										() => included.includes(source.id), (on) => setIncluded(source.id, on)
									}
								/>
							{/each}
						</div>
					</fieldset>

					<!-- 보상에 딸린 칸: 넓은 화면에서는 두 칸씩 -->
					<div class="grid gap-4 xl:grid-cols-2">
						{#if tactical && included.includes(tactical.id)}
							<NumberField
								label={m.income_input_tactical()}
								bind:value={tacticalDaily}
								help={m.income_help_tactical({
									min: formatInt(tactical.amountRange?.min ?? 0),
									max: formatInt(tactical.amountRange?.max ?? 0)
								})}
							/>
						{/if}

						{#if raidRank && included.includes(raidRank.id)}
							<SelectField
								label={m.income_input_raid_tier()}
								bind:value={raidTier}
								options={tierOptions}
							/>
						{/if}

						{#if eventSource && included.includes(eventSource.id)}
							<SelectField
								label={m.income_input_participation()}
								bind:value={participation}
								options={participationOptions}
								help={m.income_help_event({
									min: formatInt(eventSource.amountRange?.min ?? 0),
									max: formatInt(eventSource.amountRange?.max ?? 0),
									amount: formatInt(eventSource.amount ?? 0)
								})}
							/>
						{/if}
					</div>

					<div class="grid grid-cols-2 gap-4">
						{#each data.subscriptions as product (product.id)}
							<SelectField
								label={product.name}
								bind:value={subscriptions[product.id]}
								options={subscriptionOptions(product.durationDays)}
								help={m.income_help_subscription({
									instant: formatInt(product.instant),
									daily: formatInt(product.daily),
									days: m.unit_days({ count: formatInt(product.durationDays) })
								})}
							/>
						{/each}
					</div>
				</div>
			</Panel>
		</div>
	</div>
</main>
