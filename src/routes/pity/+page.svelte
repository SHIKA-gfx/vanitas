<!--
	/ko/pity — 천장·확률 계산기
	모바일: 결과 → 입력 → 곡선 (입력과 결과가 붙어 있어야 실시간 재계산이 보인다)
	데스크톱: 왼쪽 입력, 오른쪽 결과 + 곡선

	모집 스택 전환 (2026-11-10, 2026-10-23 결정)
	- 전환 전에는 지금 방식이 기본. 결과 패널 위 안내 띠에서 "개편 이후"를 고르면 전환일의 규칙으로 계산한다
	- 고르는 것은 규칙을 고를 날짜뿐이다 (ruleDate). 계산은 그 날짜로 getPityRule이 정한다
	- 전환일부터는 다음 전환이 없어 안내 띠와 선택지가 저절로 사라진다
	- 입력칸은 규칙을 따른다: 포인트 → 풀별 포인트 칸, 스택 → 스택 종류별 칸 + 접어 둔 모집 마일리지
-->
<script lang="ts">
	import Seo from '$lib/components/Seo.svelte';
	import { m } from '$lib/paraglide/messages.js';
	import { getLocale } from '$lib/paraglide/runtime.js';
	import {
		getApConfig,
		getGameConfig,
		getNextPitySystem,
		getPityRule,
		listBannerTypes
	} from '$lib/data';
	import { formatDate, formatInt, formatRate } from '$lib/format';
	import { gameToday } from '$lib/game-date';
	import type { BannerType } from '$lib/data/types';
	import { bannerAvailability, evaluateBanner } from '$lib/calc/gacha-adapter';
	import Panel from '$lib/components/Panel.svelte';
	import NumberField from '$lib/components/NumberField.svelte';
	import SelectField from '$lib/components/SelectField.svelte';
	import SegmentedField from '$lib/components/SegmentedField.svelte';
	import { getUserState } from '$lib/state/user-state.svelte';
	import { persistSection } from '$lib/state/saved.svelte';
	import { isOneOf } from '$lib/state/persist';
	import ResetButton from '$lib/components/ResetButton.svelte';
	import ShareButton from '$lib/components/ShareButton.svelte';
	import { track } from '$lib/analytics';
	import PityResult from './PityResult.svelte';
	import ProbabilityCurve from './ProbabilityCurve.svelte';

	// 천장 규칙은 날짜에 따라 바뀐다 (2026-11-10 모집 스택 전환). 오늘의 게임 날짜로 계산한다
	const ap = getApConfig();
	const today = gameToday(new Date(), ap.purchase.resetTime, ap.purchase.resetTimezone);
	const chargeSystem = getGameConfig().chargeSystem;
	/** 다음 천장 시스템 전환. 전환일부터는 null */
	const nextSystem = getNextPitySystem(today);

	type View = 'now' | 'after';
	let view = $state<View>('now');
	/** 규칙을 고를 날짜. "개편 이후"면 전환일, 아니면 오늘 */
	const ruleDate = $derived(nextSystem && view === 'after' ? nextSystem.effectiveFrom : today);

	// 천장이 없는 배너(선별 모집)는 이 계산기의 대상이 아니므로 목록에서 뺀다.
	const banners = listBannerTypes().filter((b) => b.pointPool !== null);
	const nameOf = (b: BannerType) => (getLocale() === 'ja' ? b.nameJa : b.nameKo);

	// 데이터가 아직 없는 배너(특별 픽업·페스 등)는 숨기지 않고 "준비 중"으로 보여준다.
	// 개편 이후 규칙이 공지되지 않은 배너(상시·리콜렉트·앙코르)도 그 기준에서는 "준비 중"
	const bannerOptions = $derived(
		banners.map((b) => ({
			value: b.id,
			label: bannerAvailability(b.id, { date: ruleDate })
				? m.pity_banner_preparing({ name: nameOf(b) })
				: nameOf(b)
		}))
	);

	const defaultBanner = banners.find((b) => b.id === 'pickup_normal')?.id ?? banners[0].id;
	let bannerId = $state(defaultBanner);

	// 브라우저 저장 (2026-10-02). 보유 재화는 공유 값이라 레이아웃이 저장한다
	const saved = persistSection(
		'pity',
		() => ({ bannerId, view }),
		(v) => {
			bannerId = v.bannerId;
			view = v.view;
		},
		() => ({ bannerId: defaultBanner, view: 'now' as View }),
		{ bannerId: isOneOf(banners.map((b) => b.id)), view: isOneOf(['now', 'after']) },
		// 공유 링크: 모집 + 계산 기준 + 보유 재화 (예: ?b=pickup_fes&v=after&g=24000&st=limited.40)
		{
			fields: [
				{ key: 'bannerId', param: 'b', kind: 'str' },
				{ key: 'view', param: 'v', kind: 'str' }
			],
			user: ['gems', 'singleTickets', 'tenPullTickets', 'pointsByPool', 'stackByType', 'mileage']
		}
	);
	// 보유 재화는 다른 계산기와 함께 쓴다 (UserState)
	const res = getUserState().resources;
	// 포인트는 풀별로 따로 기억한다(UserState). 배너를 바꾸면 해당 풀의 값이 불러와진다.

	const banner = $derived(banners.find((b) => b.id === bannerId) ?? banners[0]);
	// 그 날짜의 규칙이 입력칸을 정한다: 포인트 풀 / 스택 종류 / 없음
	const rule = $derived(getPityRule(bannerId, ruleDate));
	const pool = $derived(rule.kind === 'point' ? rule.pool : null);
	const stackType = $derived(rule.kind === 'charge' ? rule.chargeType : null);
	const usesMileage = $derived(
		rule.kind === 'charge' && chargeSystem.mileage.sharedAcross.includes(bannerId)
	);
	const stackMax = chargeSystem.hardPity.count - 1;

	const currentValue = $derived(
		pool ? (res.pointsByPool[pool.id] ?? 0) : stackType ? (res.stackByType[stackType.id] ?? 0) : 0
	);

	const result = $derived(
		evaluateBanner({
			bannerId,
			date: ruleDate,
			gems: res.gems,
			singleTickets: res.singleTickets,
			tenPullTickets: res.tenPullTickets,
			currentPoints: currentValue,
			mileage: usesMileage ? res.mileage : 0
		})
	);

	// 지금 방식으로 보는 중에 쌓인 모집 포인트가 천장에 못 미치면, 전환 때 사라질 수 있다고 알린다
	const pointsAtRisk = $derived(
		nextSystem !== null &&
			view === 'now' &&
			pool !== null &&
			pool.underCharge === 'replaced' &&
			currentValue > 0 &&
			currentValue < pool.pityThreshold
	);

	const curve = $derived.by(() => {
		if (!result.ok) return null;
		const v = result.evaluation.verdict;
		if (v.kind === 'exchange_now') return null;
		const pity = result.evaluation.pity;
		return {
			points: result.evaluation.curve,
			pullsToPity: v.pullsToPity,
			availablePulls: result.evaluation.budget.total,
			// 반천장이 아직 앞에 있을 때만 표시 (이월 스택이 100 이상이면 지나간 것)
			halfAt: pity.system === 'charge' && pity.half.pullsTo > 0 ? pity.half.pullsTo : undefined
		};
	});
</script>

<Seo title={`${m.pity_page_title()} | ${m.app_title()}`} description={m.meta_pity_description()} />

<main class="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6 md:grid md:grid-cols-2 md:gap-6">
	<!-- 제목 줄: 제목 + 입력 초기화 (모바일은 오른쪽 끝에 홈 로고가 있어 초기화는 아이콘만) -->
	<div class="flex items-center gap-2 md:col-span-2">
		<h1 class="text-[1.75rem] font-bold text-ink">{m.pity_page_title()}</h1>
		<ResetButton onreset={saved.reset} />
	</div>

	<div class="flex flex-col gap-3 md:col-start-2 md:row-start-2">
		<!-- 모집 개편 안내 띠: 안내와 계산 기준 선택을 한자리에 (2026-10-23 결정) -->
		{#if nextSystem}
			<div class="flex flex-col gap-3 rounded-lg bg-wash px-4 py-3">
				<p class="text-sm leading-relaxed text-ink">
					{m.pity_switch_notice({ date: formatDate(nextSystem.effectiveFrom) })}
				</p>
				<SegmentedField
					label={m.pity_switch_view_label()}
					bind:value={
						() => view,
						(v) => {
							view = v as View;
							track('pity-view', { view: v });
						}
					}
					options={[
						{ value: 'now', label: m.pity_switch_view_now() },
						{ value: 'after', label: m.pity_switch_view_after() }
					]}
				/>
				{#if pointsAtRisk && pool}
					<p class="text-sm leading-relaxed text-navy">
						{m.pity_switch_points_warning({
							date: formatDate(nextSystem.effectiveFrom),
							threshold: formatInt(pool.pityThreshold)
						})}
					</p>
				{/if}
			</div>
		{/if}
		<PityResult
			{result}
			bannerName={nameOf(banner)}
			stackName={stackType?.name}
			halfPickupChance={formatRate(chargeSystem.softPity.pickupChance)}
		>
			{#snippet actions()}<ShareButton url={saved.shareUrl} />{/snippet}
		</PityResult>
	</div>

	<!-- 두 열의 바닥을 맞춘다: 입력 패널을 오른쪽 열(결과 + 그래프) 높이까지 늘인다 -->
	<div class="md:col-start-1 md:row-span-2 md:row-start-2 md:flex md:flex-col">
		<Panel class="md:flex-1">
			<div class="flex flex-col gap-4">
				<SelectField
					label={m.pity_input_banner()}
					bind:value={
						() => bannerId,
						(v) => {
							bannerId = v;
							track('pity-banner', { banner: v });
						}
					}
					options={bannerOptions}
				/>
				<NumberField label={m.pity_input_gems()} bind:value={res.gems} />
				<div class="grid grid-cols-2 gap-4">
					<NumberField label={m.pity_input_single_tickets()} bind:value={res.singleTickets} />
					<NumberField label={m.pity_input_ten_tickets()} bind:value={res.tenPullTickets} />
				</div>
				{#if pool}
					<NumberField
						label={pool.name}
						bind:value={
							() => currentValue,
							(v) => {
								if (pool) res.pointsByPool[pool.id] = v;
							}
						}
					/>
				{:else if stackType}
					<!-- 스택은 종류별로 따로 기억한다 (모집 스택 / 특별 스택). 배너를 바꾸면 그 종류의 값이 불러와진다 -->
					<NumberField
						label={stackType.name}
						max={stackMax}
						hint={m.pity_input_stack_hint({ max: formatInt(stackMax) })}
						bind:value={
							() => currentValue,
							(v) => {
								if (stackType) res.stackByType[stackType.id] = v;
							}
						}
					/>
				{/if}
				{#if usesMileage}
					<!-- 모집 마일리지: 한 기간 안에서는 결과를 거의 바꾸지 않아 접어 둔다 (2026-10-14 결정) -->
					<details class="group rounded-lg bg-wash/60">
						<summary
							class="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 text-sm text-navy hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-strong"
						>
							<span>{m.pity_mileage_toggle()}</span>
							<span class="flex items-center gap-2 tabular-nums">
								{#if res.mileage > 0}<span class="text-ink">{formatInt(res.mileage)}</span>{/if}
								<span aria-hidden="true" class="transition-transform group-open:rotate-180">▾</span>
							</span>
						</summary>
						<div class="px-3 pb-3">
							<NumberField
								label={m.pity_input_mileage()}
								hint={m.pity_input_mileage_hint()}
								bind:value={res.mileage}
							/>
						</div>
					</details>
				{/if}
			</div>
		</Panel>
	</div>

	{#if curve}
		<div class="md:col-start-2 md:row-start-3">
			<Panel title={m.pity_curve_title()}>
				<ProbabilityCurve
					curve={curve.points}
					pullsToPity={curve.pullsToPity}
					availablePulls={curve.availablePulls}
					halfAt={curve.halfAt}
				/>
			</Panel>
		</div>
	{/if}
</main>
