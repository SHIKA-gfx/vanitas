<!--
	미래시 기간 목록 (docs/006 6-2의 2). DB에서 읽은 그대로를 사이트와 같은 모양(convert.ts)으로 보여 준다.
	편집은 다음 단계(④-2)에서 이 목록에 붙인다.
-->
<script lang="ts">
	import Badge from '$lib/components/Badge.svelte';
	import Panel from '$lib/components/Panel.svelte';
	import type { RecruitOverview } from './admin-data';
	import { formatPeriod } from './admin-data';

	let { overview, class: className = '' }: { overview: RecruitOverview; class?: string } = $props();

	const name = (id: string) => overview.studentName.get(id) ?? id;
	const banner = (type: string) => overview.bannerName.get(type) ?? type;
</script>

<Panel title="미래시 · {overview.recruits.length}기간" class={className}>
	{#if overview.recruits.length === 0}
		<p class="text-sm text-navy">기간이 없어요.</p>
	{:else}
		<ul class="flex flex-col gap-3">
			{#each overview.recruits as r (r.id)}
				<li class="rounded-lg bg-wash px-4 py-3">
					<div class="flex flex-wrap items-center gap-x-2 gap-y-1">
						<span class="font-num font-semibold text-ink">{formatPeriod(r.start, r.end)}</span>
						{#if r.status === 'estimated'}
							<Badge>추정</Badge>
						{/if}
						{#if r.freePulls}
							<span class="text-xs text-navy">무료 모집 {r.freePulls}회</span>
						{/if}
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
</Panel>
