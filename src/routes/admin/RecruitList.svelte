<!--
	미래시 기간 목록 (docs/006 6-2의 2). DB에서 읽은 그대로를 사이트와 같은 모양(convert.ts)으로 보여 준다.
	- "새 기간"·"고치기"로 편집 화면(RecruitEditor)을 연다 (④-2)
	- 사이트 반영 상태: 이 화면을 연 배포에 들어 있는 기간과 비교해 다르면 "반영 전" (recruit-edit.ts compareWithSite)
-->
<script lang="ts">
	import Badge from '$lib/components/Badge.svelte';
	import Panel from '$lib/components/Panel.svelte';
	import type { RecruitPeriod } from '$lib/data/types';
	import AdminButton from './AdminButton.svelte';
	import type { RecruitOverview } from './admin-data';
	import { formatPeriod } from './admin-data';
	import type { SiteSync } from './recruit-edit';

	interface Props {
		overview: RecruitOverview;
		sync: SiteSync;
		/** 고치기(기간) 또는 새 기간(null) */
		onedit: (recruit: RecruitPeriod | null) => void;
	}
	let { overview, sync, onedit }: Props = $props();

	const name = (id: string) => overview.studentName.get(id) ?? id;
	const banner = (type: string) => overview.bannerName.get(type) ?? type;
	const pending = $derived([...sync.byId.values()].filter((s) => s !== 'same').length);
</script>

<Panel title="미래시 · {overview.recruits.length}기간">
	<div class="flex flex-col gap-4">
		<div class="flex flex-wrap items-center gap-x-2 gap-y-3">
			<AdminButton variant="primary" onclick={() => onedit(null)}>새 기간</AdminButton>
			<p class="min-w-0 flex-1 text-xs text-navy">
				{#if pending === 0 && sync.removed.length === 0}
					사이트와 같아요
				{:else}
					사이트에 아직 반영되지 않은 바뀜: 기간 {pending + sync.removed.length}개. 배포가 끝난 뒤
					이 화면을 새로 고치면 다시 비교해요
				{/if}
			</p>
		</div>
		{#if sync.removed.length > 0}
			<p class="text-xs text-navy">
				지웠지만 사이트에는 아직 있는 기간:
				<span class="font-mono break-all">{sync.removed.join(', ')}</span>
			</p>
		{/if}

		{#if overview.recruits.length === 0}
			<p class="text-sm text-navy">기간이 없어요.</p>
		{:else}
			<ul class="flex flex-col gap-3">
				{#each overview.recruits as r (r.id)}
					{@const state = sync.byId.get(r.id)}
					<li class="rounded-lg bg-wash px-4 py-3">
						<div class="flex flex-wrap items-center gap-x-2 gap-y-1">
							<span class="font-num font-semibold text-ink">{formatPeriod(r.start, r.end)}</span>
							{#if r.status === 'estimated'}
								<Badge>추정</Badge>
							{/if}
							{#if state === 'changed'}
								<Badge>반영 전</Badge>
							{:else if state === 'new'}
								<Badge>새 기간 · 반영 전</Badge>
							{/if}
							{#if r.freePulls}
								<span class="text-xs text-navy">무료 모집 {r.freePulls}회</span>
							{/if}
							<button
								type="button"
								class="ml-auto inline-flex min-h-9 items-center gap-1 px-1 text-sm font-bold text-brand-strong hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-strong"
								aria-label="{formatPeriod(r.start, r.end)} 기간 고치기"
								onclick={() => onedit(r)}
							>
								<svg
									class="size-4"
									viewBox="0 0 16 16"
									fill="none"
									stroke="currentColor"
									stroke-width="1.75"
									stroke-linecap="round"
									stroke-linejoin="round"
									aria-hidden="true"
								>
									<path d="M10.5 2.5l3 3L6 13H3v-3z" />
								</svg>
								고치기
							</button>
						</div>
						<p class="mt-0.5 font-mono text-xs break-all text-navy">{r.id}</p>
						<ul class="mt-2 flex flex-col gap-1 text-sm text-ink">
							{#each r.banners as b, i (i)}
								<li>
									<span class="text-navy">{banner(b.type)} ·</span>
									<span class="font-medium">{b.students.map(name).join(', ')}</span>
								</li>
							{/each}
						</ul>
						{#if r.offPickup?.length || r.previousIds?.length || r.event}
							<dl class="mt-2 flex flex-col gap-0.5 text-xs text-navy">
								{#if r.event}
									<div>
										<dt class="inline font-medium">이벤트</dt>
										<dd class="inline">{r.event}</dd>
									</div>
								{/if}
								{#if r.offPickup?.length}
									<div>
										<dt class="inline font-medium">픽업 외</dt>
										<dd class="inline">{r.offPickup.map(name).join(', ')}</dd>
									</div>
								{/if}
								{#if r.previousIds?.length}
									<div>
										<dt class="inline font-medium">예전 id</dt>
										<dd class="inline font-mono break-all">{r.previousIds.join(', ')}</dd>
									</div>
								{/if}
							</dl>
						{/if}
						<p class="mt-2 text-xs text-navy">출처 {r.sources.join(', ')}</p>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</Panel>
