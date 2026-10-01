<!--
	/ko/levelup — 레벨업 계산기
	모바일: 결과 → 입력 → 곡선 (확률 계산기와 같은 배치, 디자인 문서 5-6)
	데스크톱: 왼쪽 입력, 오른쪽 결과 + 곡선
-->
<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { getApConfig, getCafeRank, getLevelTable, listCafeRanks } from '$lib/data';
	import {
		LOGIN_OPTIONS,
		apPurchaseCostPerDay,
		calculateLevelUp,
		tacticalPerDay,
		toLevelCurve
	} from '$lib/calc/levelup-adapter';
	import { addDays, gameToday } from '$lib/game-date';
	import { formatInt } from '$lib/format';
	import Panel from '$lib/components/Panel.svelte';
	import NumberField from '$lib/components/NumberField.svelte';
	import SelectField from '$lib/components/SelectField.svelte';
	import SegmentedField from '$lib/components/SegmentedField.svelte';
	import CheckboxField from '$lib/components/CheckboxField.svelte';
	import DateField from '$lib/components/DateField.svelte';
	import { getUserState } from '$lib/state/user-state.svelte';
	import LevelUpResult from './LevelUpResult.svelte';
	import LevelCurve from './LevelCurve.svelte';

	const ap = getApConfig();
	const levels = getLevelTable().levels;
	const maxLevel = levels.length;
	const cafeRanks = listCafeRanks();
	const regularIncome = ap.fixedIncome.filter((i) => i.durationDays === undefined);
	const packageItem = ap.fixedIncome.find((i) => i.durationDays !== undefined);

	// 계산 기준일. 브라우저에서 스크립트가 실행될 때의 게임 날짜 (04:00 초기화 기준)
	const today = gameToday(new Date(), ap.purchase.resetTime, ap.purchase.resetTimezone);

	// ---------------------------------------------------------------- 선택지

	const modeOptions = [
		{ value: 'level', label: m.levelup_mode_level() },
		{ value: 'date', label: m.levelup_mode_date() }
	];

	const loginOptions = LOGIN_OPTIONS.map((n, i) => ({
		value: String(n),
		label:
			i === LOGIN_OPTIONS.length - 1
				? m.levelup_logins_option_max({ count: String(n) })
				: m.levelup_logins_option({ count: String(n) })
	}));

	const rankOptions = cafeRanks.map((r) => ({
		value: String(r.rank),
		label: m.levelup_cafe_rank_option({ rank: String(r.rank) })
	}));

	const tacticalOptions = [
		{ value: 'none', label: m.levelup_tactical_none() },
		...Array.from({ length: ap.tacticalShop.refresh.maxPerDay + 1 }, (_, n) => {
			const apPerDay = formatInt(tacticalPerDay(n)?.ap ?? 0);
			return {
				value: String(n),
				label:
					n === 0
						? m.levelup_tactical_no_refresh({ ap: apPerDay })
						: m.levelup_tactical_refresh({ count: String(n), ap: apPerDay })
			};
		})
	];

	/** 2주 AP 패키지 선택지: 안 함 / 1~6회 / 계속 */
	const PACKAGE_MAX_COUNT = 6;
	const packageOptions = packageItem
		? [
				{ value: '0', label: m.levelup_package_none() },
				...Array.from({ length: PACKAGE_MAX_COUNT }, (_, i) => ({
					value: String(i + 1),
					label: m.levelup_package_count({
						count: String(i + 1),
						days: m.unit_days({ count: formatInt((i + 1) * (packageItem.durationDays ?? 0)) })
					})
				})),
				{ value: 'continuous', label: m.levelup_package_continuous() }
			]
		: [];

	const packageHelp = packageItem
		? m.levelup_help_package({
				days: m.unit_days({ count: formatInt(packageItem.durationDays ?? 0) }),
				ap: formatInt(packageItem.ap)
			})
		: '';

	// 가격 구간은 데이터에서 만든다 — 단가가 바뀌면 설명도 따라 바뀐다
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

	let mode = $state('level');
	let level = $state(1);
	let exp = $state(0);
	let currentAp = $state(0);
	let targetLevel = $state(maxLevel);
	let targetDate = $state(addDays(today, 30));

	let logins = $state('2');
	let cafeRank = $state('1');
	// 쾌적도는 랭크별로 기억한다. 처음 고른 랭크는 그 랭크의 최대 쾌적도로 시작한다.
	let comfortByRank = $state<Record<string, number>>({});
	let disabledIncome = $state<string[]>([]);
	let apPackage = $state('0');
	let tactical = $state('none');
	// 하루 AP 구매 횟수는 청휘석 수급 계산기와 함께 쓴다 (UserState)
	const habits = getUserState().habits;

	const rank = $derived(getCafeRank(Number(cafeRank)));
	const comfort = $derived(comfortByRank[cafeRank] ?? rank.maxComfort);
	const expToNext = $derived(levels[level - 1]?.expToNext ?? null);

	const result = $derived(
		calculateLevelUp({
			level,
			exp,
			currentAp,
			logins: Number(logins),
			cafeRank: Number(cafeRank),
			cafeComfort: comfort,
			disabledIncome,
			apPackage: apPackage === 'continuous' ? 'continuous' : Number(apPackage),
			tacticalRefreshes: tactical === 'none' ? null : Number(tactical),
			apPurchases: habits.apPurchasesPerDay,
			today,
			goal:
				mode === 'level'
					? { mode: 'level', target: targetLevel }
					: { mode: 'date', date: targetDate }
		})
	);

	const curve = $derived.by(() => {
		if (result.kind !== 'reached' && result.kind !== 'projected') return null;
		if (result.records.length < 2) return null; // 0일 도달은 그릴 선이 없다
		return {
			points: toLevelCurve(result.records),
			target: result.kind === 'reached' ? targetLevel : null
		};
	});

	function setIncome(id: string, on: boolean) {
		disabledIncome = on ? disabledIncome.filter((x) => x !== id) : [...disabledIncome, id];
	}

	// 입력 오류는 결과 카드와 함께 해당 칸에도 보여준다 (디자인 문서 5-8)
	const fieldError = (field: 'exp' | 'goal') =>
		result.kind !== 'invalid' || result.field !== field
			? undefined
			: field === 'exp'
				? m.levelup_invalid_exp()
				: m.levelup_invalid_goal_date();

	const purchaseCost = $derived(apPurchaseCostPerDay(habits.apPurchasesPerDay));
	const tacticalCost = $derived(tactical === 'none' ? null : tacticalPerDay(Number(tactical)));
</script>

<svelte:head>
	<title>{m.levelup_page_title()} | {m.app_title()}</title>
</svelte:head>

<!--
	배치 (2026-09-30, 수급 계산기와 같은 방식)
	- 모바일: 결과 → 지금 상태 → 하루 AP 수급 → 그래프 (order로 순서)
	- md(2칸): 왼쪽 입력 두 패널 / 오른쪽 결과 + 그래프
	- xl(3칸): 지금 상태 | 하루 AP 수급 | 결과 + 그래프. 열 바닥을 맞추고 패널 사이 간격은 어디서나 같게
-->
<main
	class="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6 md:grid md:grid-cols-2 md:gap-6 xl:max-w-7xl xl:grid-cols-3"
>
	<h1 class="text-2xl text-ink md:col-span-2 xl:col-span-3">{m.levelup_page_title()}</h1>

	<!-- 결과 열 -->
	<div class="contents xl:col-start-3 xl:row-start-2 xl:flex xl:flex-col xl:gap-6">
		<div class="order-1 md:order-none md:col-start-2 md:row-start-2">
			<LevelUpResult {result} target={targetLevel} />
		</div>
		{#if curve}
			<div
				class="order-3 md:order-none md:col-start-2 md:row-start-3 xl:flex xl:flex-1 xl:flex-col"
			>
				<Panel title={m.levelup_curve_title()} class="xl:flex-1">
					<LevelCurve points={curve.points} target={curve.target} />
				</Panel>
			</div>
		{/if}
	</div>

	<!-- 입력 열 (xl에서는 두 열로 나뉜다) -->
	<div
		class="order-2 flex flex-col gap-4 md:order-none md:col-start-1 md:row-span-2 md:row-start-2 md:gap-6 xl:contents"
	>
		<div class="xl:col-start-1 xl:row-start-2 xl:flex xl:flex-col">
			<Panel title={m.levelup_section_state()} class="xl:flex-1">
				<div class="flex flex-col gap-3">
					<SegmentedField label={m.levelup_mode_label()} bind:value={mode} options={modeOptions} />
					<div class="grid grid-cols-2 gap-3">
						<NumberField
							label={m.levelup_input_level()}
							bind:value={level}
							min={1}
							max={maxLevel}
						/>
						<NumberField
							label={m.levelup_input_exp()}
							bind:value={exp}
							error={fieldError('exp')}
							max={expToNext === null ? 0 : expToNext - 1}
							hint={expToNext === null
								? undefined
								: m.levelup_input_exp_hint({ need: formatInt(expToNext) })}
						/>
					</div>
					<NumberField
						label={m.levelup_input_current_ap()}
						bind:value={currentAp}
						hint={m.levelup_input_current_ap_hint()}
					/>
					{#if mode === 'level'}
						<NumberField
							label={m.levelup_input_target_level()}
							bind:value={targetLevel}
							min={1}
							max={maxLevel}
						/>
					{:else}
						<DateField
							label={m.levelup_input_target_date()}
							bind:value={targetDate}
							min={today}
							error={fieldError('goal')}
						/>
					{/if}
				</div>
			</Panel>
		</div>
		<div class="xl:col-start-2 xl:row-start-2 xl:flex xl:flex-col">
			<Panel title={m.levelup_section_income()} class="xl:flex-1">
				<div class="flex flex-col gap-3">
					<SelectField
						label={m.levelup_input_logins()}
						bind:value={logins}
						options={loginOptions}
						help={m.levelup_help_logins()}
					/>
					<div class="grid grid-cols-2 gap-3">
						<SelectField
							label={m.levelup_input_cafe_rank()}
							bind:value={cafeRank}
							options={rankOptions}
							help={m.levelup_help_cafe()}
						/>
						<NumberField
							label={m.levelup_input_cafe_comfort()}
							bind:value={
								() => comfort,
								(v) => {
									comfortByRank[cafeRank] = v;
								}
							}
							max={rank.maxComfort}
						/>
					</div>

					<fieldset>
						<legend class="text-sm text-navy">{m.levelup_input_fixed_income()}</legend>
						<div class="grid grid-cols-2 gap-x-3">
							{#each regularIncome as item (item.id)}
								<CheckboxField
									label={item.name}
									bind:checked={
										() => !disabledIncome.includes(item.id), (on) => setIncome(item.id, on)
									}
								/>
							{/each}
						</div>
					</fieldset>

					<!-- 넓은 화면에서는 패키지와 전술대회를 나란히 -->
					<div class="grid gap-3 xl:grid-cols-2">
						{#if packageItem}
							<SelectField
								label={packageItem.name}
								bind:value={apPackage}
								options={packageOptions}
								help={packageHelp}
							/>
						{/if}

						<div>
							<SelectField
								label={m.levelup_input_tactical()}
								bind:value={tactical}
								options={tacticalOptions}
							/>
							{#if tacticalCost}
								<p class="mt-1 text-xs text-navy tabular-nums">
									{m.levelup_tactical_hint({ coins: formatInt(tacticalCost.coins) })}
								</p>
							{/if}
						</div>
					</div>

					<NumberField
						label={m.levelup_input_purchases()}
						bind:value={habits.apPurchasesPerDay}
						max={ap.purchase.maxPurchasesPerDay}
						help={purchaseHelp}
						hint={purchaseCost
							? m.levelup_purchases_hint({ gems: formatInt(purchaseCost) })
							: undefined}
					/>
				</div>
			</Panel>
		</div>
	</div>
</main>
