<!--
	/ko/pity — 천장·확률 계산기
	모바일: 결과 → 입력 → 곡선 (입력과 결과가 붙어 있어야 실시간 재계산이 보인다)
	데스크톱: 왼쪽 입력, 오른쪽 결과 + 곡선
-->
<script lang="ts">
	import Seo from '$lib/components/Seo.svelte';
	import { m } from '$lib/paraglide/messages.js';
	import { getLocale } from '$lib/paraglide/runtime.js';
	import { getPointPool, listBannerTypes } from '$lib/data';
	import type { BannerType } from '$lib/data/types';
	import { bannerAvailability, evaluateBanner } from '$lib/calc/gacha-adapter';
	import Panel from '$lib/components/Panel.svelte';
	import NumberField from '$lib/components/NumberField.svelte';
	import SelectField from '$lib/components/SelectField.svelte';
	import { getUserState } from '$lib/state/user-state.svelte';
	import { persistSection } from '$lib/state/saved.svelte';
	import { isOneOf } from '$lib/state/persist';
	import ResetButton from '$lib/components/ResetButton.svelte';
	import ShareButton from '$lib/components/ShareButton.svelte';
	import { track } from '$lib/analytics';
	import PityResult from './PityResult.svelte';
	import ProbabilityCurve from './ProbabilityCurve.svelte';

	// 천장이 없는 배너(선별 모집)는 이 계산기의 대상이 아니므로 목록에서 뺀다.
	const banners = listBannerTypes().filter((b) => b.pointPool !== null);
	const nameOf = (b: BannerType) => (getLocale() === 'ja' ? b.nameJa : b.nameKo);

	// 데이터가 아직 없는 배너(특별 픽업·페스 등)는 숨기지 않고 "준비 중"으로 보여준다.
	const bannerOptions = banners.map((b) => ({
		value: b.id,
		label: bannerAvailability(b.id) ? m.pity_banner_preparing({ name: nameOf(b) }) : nameOf(b)
	}));

	const defaultBanner = banners.find((b) => b.id === 'pickup_normal')?.id ?? banners[0].id;
	let bannerId = $state(defaultBanner);

	// 브라우저 저장 (2026-10-02). 보유 재화는 공유 값이라 레이아웃이 저장한다
	const saved = persistSection(
		'pity',
		() => ({ bannerId }),
		(v) => {
			bannerId = v.bannerId;
		},
		() => ({ bannerId: defaultBanner }),
		{ bannerId: isOneOf(banners.map((b) => b.id)) },
		// 공유 링크: 모집 + 보유 재화 (예: ?b=pickup_fes&g=24000)
		{
			fields: [{ key: 'bannerId', param: 'b', kind: 'str' }],
			user: ['gems', 'singleTickets', 'tenPullTickets', 'pointsByPool']
		}
	);
	// 보유 재화는 다른 계산기와 함께 쓴다 (UserState)
	const res = getUserState().resources;
	// 포인트는 풀별로 따로 기억한다(UserState). 배너를 바꾸면 해당 풀의 값이 불러와진다.

	const banner = $derived(banners.find((b) => b.id === bannerId) ?? banners[0]);
	const pool = $derived(banner.pointPool ? getPointPool(banner.pointPool) : null);
	const currentPoints = $derived(pool ? (res.pointsByPool[pool.id] ?? 0) : 0);

	const result = $derived(
		evaluateBanner({
			bannerId,
			gems: res.gems,
			singleTickets: res.singleTickets,
			tenPullTickets: res.tenPullTickets,
			currentPoints
		})
	);

	const curve = $derived.by(() => {
		if (!result.ok) return null;
		const v = result.evaluation.verdict;
		if (v.kind !== 'guaranteed' && v.kind !== 'short') return null;
		return {
			points: result.evaluation.curve,
			pullsToPity: v.pullsToPity,
			availablePulls: result.evaluation.budget.total
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

	<div class="md:col-start-2 md:row-start-2">
		<PityResult {result} bannerName={nameOf(banner)}>
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
							() => currentPoints,
							(v) => {
								if (pool) res.pointsByPool[pool.id] = v;
							}
						}
					/>
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
				/>
			</Panel>
		</div>
	{/if}
</main>
