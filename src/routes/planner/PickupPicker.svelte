<!--
	예정 픽업 목록 — 기간마다 픽업 학생을 눌러 목표로 고른다 (2026-10-24 결정).
	누르기 단추는 aria-pressed로 상태를 알린다. 가칭 학생은 "가칭" + 일본 공식 이름 (docs/005 4-1)
-->
<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { formatDate } from '$lib/format';
	import Badge from '$lib/components/Badge.svelte';
	import type { PlannerChoicePeriod } from '$lib/calc/planner-adapter';
	import { targetKey, type TargetKey } from './target-key';

	interface Props {
		periods: PlannerChoicePeriod[];
		selected: TargetKey[];
		ontoggle: (key: TargetKey) => void;
	}

	let { periods, selected, ontoggle }: Props = $props();
</script>

<ol class="flex flex-col gap-4">
	{#each periods as { recruit, choices } (recruit.id)}
		<li class="flex flex-col gap-2">
			<div class="flex flex-wrap items-center gap-2 text-sm">
				<span class="font-num text-ink">{formatDate(recruit.start)}</span>
				{#if recruit.status === 'estimated'}<Badge>{m.planner_estimated()}</Badge>{/if}
				{#if recruit.event}<span class="text-navy">{recruit.event}</span>{/if}
				{#if recruit.freePulls}
					<span class="font-num text-navy"
						>{m.planner_free_pulls({ count: recruit.freePulls })}</span
					>
				{/if}
			</div>
			<ul class="flex flex-wrap gap-2">
				{#each choices as c (c.studentId)}
					{@const key = targetKey(c.recruitId, c.studentId)}
					{@const on = selected.includes(key)}
					<li>
						<button
							type="button"
							aria-pressed={on}
							onclick={() => ontoggle(key)}
							class="flex min-h-11 flex-col items-start justify-center rounded-lg border px-3 py-1.5 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-brand-strong {on
								? 'border-brand-strong bg-brand-strong text-white'
								: 'border-sky-muted bg-surface text-ink hover:border-brand-strong'}"
						>
							<span class="flex items-center gap-1.5">
								{c.student.name.ko}
								{#if c.student.koNameStatus === 'provisional'}
									<span class="text-xs {on ? 'text-white' : 'text-navy'}"
										>{m.planner_provisional()}</span
									>
								{/if}
							</span>
							<span class="text-xs {on ? 'text-white' : 'text-navy'}">
								{c.stack.name}{#if c.student.koNameStatus === 'provisional' && c.student.name.ja}
									· {c.student.name.ja}{/if}
							</span>
						</button>
					</li>
				{/each}
			</ul>
		</li>
	{/each}
</ol>
