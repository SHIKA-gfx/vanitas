<!-- 빌드 검사(validate.py) 결과 목록. 새로 생긴 것·고쳐진 것·그대로인 것 -->
<script lang="ts">
	import type { CheckDiff } from './build-check';
	let { diff }: { diff: CheckDiff } = $props();
</script>

<div class="flex flex-col gap-2 text-sm">
	{#if diff.newErrors.length > 0}
		<div role="alert" class="rounded-lg bg-surface p-3 shadow-[inset_0_0_0_1px_rgb(137_25_40/0.4)]">
			<p class="font-bold text-blocked">
				새 오류 {diff.newErrors.length}건 — 이대로는 빌드가 멈춰요
			</p>
			<ul class="mt-1 list-disc pl-5 text-ink">
				{#each diff.newErrors as m, i (i)}<li>{m}</li>{/each}
			</ul>
		</div>
	{/if}
	{#if diff.newWarnings.length > 0}
		<div class="rounded-lg bg-surface p-3 shadow-[inset_0_0_0_1px_rgb(42_66_91/0.25)]">
			<p class="font-bold text-ink">새 경고 {diff.newWarnings.length}건 (빌드는 돼요)</p>
			<ul class="mt-1 list-disc pl-5 text-ink">
				{#each diff.newWarnings as m, i (i)}<li>{m}</li>{/each}
			</ul>
		</div>
	{/if}
	{#if diff.resolved.length > 0}
		<p class="text-xs text-navy">고쳐진 것 {diff.resolved.length}건: {diff.resolved.join(' / ')}</p>
	{/if}
	{#if diff.newErrors.length === 0 && diff.newWarnings.length === 0}
		<p class="text-xs text-navy">
			빌드 검사 통과 — 오류 {diff.after.errors.length}건 · 경고 {diff.after.warnings.length}건
			(이번에 생긴 것 없음)
		</p>
	{/if}
</div>
