<!--
	학생 목록 (docs/006 6-2의 4, ④-3). 플래너가 고를 수 있는 학생 — 전체 도감이 아니다.
	이름·일본 공식 이름·가칭·id·게임 번호·쓰이는 기간 수. 사이트에 반영 전이면 배지
-->
<script lang="ts">
	import Badge from '$lib/components/Badge.svelte';
	import Panel from '$lib/components/Panel.svelte';
	import type { Student } from '$lib/data/types';
	import AdminButton from './AdminButton.svelte';
	import type { Usage } from './catalog-edit';
	import type { SiteSync } from './recruit-edit';

	interface Props {
		students: Student[];
		usage: Usage;
		sync: SiteSync;
		onedit: (student: Student | null) => void;
	}
	let { students, usage, sync, onedit }: Props = $props();
	const pending = $derived([...sync.byId.values()].filter((s) => s !== 'same').length);
</script>

<Panel title="학생 · {students.length}명">
	<div class="flex flex-col gap-4">
		<div class="flex flex-wrap items-center gap-x-2 gap-y-3">
			<AdminButton variant="primary" onclick={() => onedit(null)}>새 학생</AdminButton>
			<p class="min-w-0 flex-1 text-xs text-navy">
				{pending + sync.removed.length === 0
					? '사이트와 같아요'
					: `사이트에 아직 반영되지 않은 학생 ${pending + sync.removed.length}명`}
			</p>
		</div>
		<ul class="flex flex-col divide-y divide-navy/10">
			{#each students as s (s.id)}
				{@const state = sync.byId.get(s.id)}
				{@const used = usage.students.get(s.id)?.length ?? 0}
				<li class="flex items-center gap-2 py-2">
					<div class="min-w-0 flex-1">
						<div class="flex flex-wrap items-center gap-x-2 gap-y-1">
							<span class="font-medium text-ink">{s.name.ko}</span>
							{#if s.koNameStatus === 'provisional'}
								<Badge>가칭</Badge>
							{/if}
							{#if state === 'changed'}
								<Badge>반영 전</Badge>
							{:else if state === 'new'}
								<Badge>새 학생 · 반영 전</Badge>
							{/if}
							{#if s.name.ja}
								<span class="text-xs text-navy">{s.name.ja}</span>
							{/if}
						</div>
						<p class="mt-0.5 text-xs text-navy">
							<span class="font-mono">{s.id}</span> · 번호 {s.gameId} · {used > 0
								? `기간 ${used}개`
								: '쓰는 기간 없음'}
						</p>
					</div>
					<button
						type="button"
						class="inline-flex min-h-9 shrink-0 items-center px-1 text-sm font-bold text-brand-strong hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-strong"
						aria-label="{s.name.ko} 고치기"
						onclick={() => onedit(s)}>고치기</button
					>
				</li>
			{/each}
		</ul>
		{#if sync.removed.length > 0}
			<p class="text-xs text-navy">
				지웠지만 사이트에는 아직 있는 학생: <span class="font-mono">{sync.removed.join(', ')}</span>
			</p>
		{/if}
	</div>
</Panel>
