<!--
	순서 있는 목록 고르기 (관리자 기간 편집). 배너 학생·픽업 외 학생·출처·예전 id.
	- 순서 바꾸기·빼기는 ▲▼✕ (플래너 목표 목록과 같은 단추 — 한 번 누르기·키보드로 된다)
	- 더하기는 아래 선택칸. 이미 고른 것과 같은 기간의 다른 칸에서 고른 것(exclude)은 선택지에서 뺀다
	- addLabel이 없으면 더하기 칸이 없다 (예전 id는 저장할 때 저절로 붙는다)
	모양은 입력칸(field)·라벨 앞 막대 그대로 (디자인 문서 5-19)
-->
<script lang="ts">
	import type { Choice } from './admin-data';

	interface Props {
		label: string;
		items: string[];
		/** 더할 수 있는 것 전부 */
		options?: Choice[];
		/** 같은 기간의 다른 칸에서 이미 고른 것 — 선택지에서 뺀다 */
		exclude?: ReadonlySet<string>;
		labelOf: (id: string) => string;
		/** 더하기 칸의 첫 줄. 없으면 더하기 칸을 두지 않는다 */
		addLabel?: string;
		hint?: string;
		/** 이 칸에 오류가 있으면 라벨 앞 막대가 blocked */
		invalid?: boolean;
	}
	let {
		label,
		items = $bindable([]),
		options = [],
		exclude,
		labelOf,
		addLabel,
		hint,
		invalid = false
	}: Props = $props();

	const id = $props.id();
	const addable = $derived(options.filter((o) => !items.includes(o.id) && !exclude?.has(o.id)));

	function move(i: number, d: -1 | 1) {
		const next = [...items];
		[next[i], next[i + d]] = [next[i + d], next[i]];
		items = next;
	}
	function remove(i: number) {
		items = items.filter((_, j) => j !== i);
	}
	function add(event: Event & { currentTarget: HTMLSelectElement }) {
		const value = event.currentTarget.value;
		if (value) items = [...items, value];
		event.currentTarget.value = '';
	}

	const SMALL =
		'grid h-9 w-8 shrink-0 place-items-center text-navy hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-strong disabled:opacity-30';
</script>

<div>
	<div class="mb-2 flex min-h-6 items-center">
		<span id="{id}-label" class="flex items-center gap-2 text-[0.8125rem] font-medium text-navy">
			<span
				aria-hidden="true"
				class="h-3 w-[3px] shrink-0 -skew-x-30 rounded-[1px_1.5px] {invalid
					? 'bg-blocked'
					: 'bg-brand'}"
			></span>
			{label}
		</span>
	</div>
	{#if items.length === 0}
		<p class="text-xs text-navy">없음</p>
	{:else}
		<ul aria-labelledby="{id}-label" class="flex flex-col gap-1">
			{#each items as item, i (item)}
				<li
					class="flex min-h-10 items-center rounded-lg bg-surface pl-3 text-sm text-ink shadow-[inset_0_0_0_1px_rgb(42_66_91/0.12)]"
				>
					<span class="min-w-0 flex-1 truncate" title={labelOf(item)}>{labelOf(item)}</span>
					<button
						type="button"
						class={SMALL}
						aria-label="{labelOf(item)} 위로"
						disabled={i === 0}
						onclick={() => move(i, -1)}>▲</button
					>
					<button
						type="button"
						class={SMALL}
						aria-label="{labelOf(item)} 아래로"
						disabled={i === items.length - 1}
						onclick={() => move(i, 1)}>▼</button
					>
					<button
						type="button"
						class="{SMALL} text-sm"
						aria-label="{labelOf(item)} 빼기"
						onclick={() => remove(i)}>✕</button
					>
				</li>
			{/each}
		</ul>
	{/if}
	{#if addLabel && addable.length > 0}
		<div class="relative mt-2">
			<select
				class="field appearance-none pr-10 text-sm text-navy"
				aria-label="{label}: {addLabel}"
				onchange={add}
			>
				<option value="">{addLabel}</option>
				{#each addable as o (o.id)}
					<option value={o.id}>{o.label}</option>
				{/each}
			</select>
			<svg
				class="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-navy/60"
				viewBox="0 0 16 16"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<path d="M8 3.5v9M3.5 8h9" />
			</svg>
		</div>
	{/if}
	{#if hint}
		<p class="mt-2 text-xs text-navy">{hint}</p>
	{/if}
</div>
