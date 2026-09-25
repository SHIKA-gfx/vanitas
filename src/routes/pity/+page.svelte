<!--
	/ko/pity — 천장·확률 계산기
	모바일: 결과 → 입력 → 곡선 (입력과 결과가 붙어 있어야 실시간 재계산이 보인다)
	데스크톱: 왼쪽 입력, 오른쪽 결과 + 곡선
-->
<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { getLocale } from '$lib/paraglide/runtime.js';
	import { getPointPool, listBannerTypes } from '$lib/data';
	import type { BannerType } from '$lib/data/types';
	import { bannerAvailability, evaluateBanner } from '$lib/calc/gacha-adapter';
	import Panel from '$lib/components/Panel.svelte';
	import NumberField from '$lib/components/NumberField.svelte';
	import SelectField from '$lib/components/SelectField.svelte';
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

	let bannerId = $state(banners.find((b) => b.id === 'pickup_normal')?.id ?? banners[0].id);
	let gems = $state(0);
	let singleTickets = $state(0);
	let tenPullTickets = $state(0);
	// 포인트는 풀별로 따로 기억한다. 배너를 바꾸면 해당 풀의 값이 불러와진다.
	let pointsByPool = $state<Record<string, number>>({});

	const banner = $derived(banners.find((b) => b.id === bannerId) ?? banners[0]);
	const pool = $derived(banner.pointPool ? getPointPool(banner.pointPool) : null);
	const currentPoints = $derived(pool ? (pointsByPool[pool.id] ?? 0) : 0);

	const result = $derived(
		evaluateBanner({ bannerId, gems, singleTickets, tenPullTickets, currentPoints })
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

<svelte:head>
	<title>{m.pity_page_title()} | {m.app_title()}</title>
</svelte:head>

<main class="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6 md:grid md:grid-cols-2 md:gap-6">
	<h1 class="text-2xl text-ink md:col-span-2">{m.pity_page_title()}</h1>

	<div class="md:col-start-2 md:row-start-2">
		<PityResult {result} bannerName={nameOf(banner)} />
	</div>

	<div class="md:col-start-1 md:row-span-2 md:row-start-2">
		<Panel>
			<div class="flex flex-col gap-3">
				<SelectField label={m.pity_input_banner()} bind:value={bannerId} options={bannerOptions} />
				<NumberField label={m.pity_input_gems()} bind:value={gems} />
				<div class="grid grid-cols-2 gap-3">
					<NumberField label={m.pity_input_single_tickets()} bind:value={singleTickets} />
					<NumberField label={m.pity_input_ten_tickets()} bind:value={tenPullTickets} />
				</div>
				{#if pool}
					<NumberField
						label={pool.name}
						bind:value={
							() => currentPoints,
							(v) => {
								if (pool) pointsByPool[pool.id] = v;
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
