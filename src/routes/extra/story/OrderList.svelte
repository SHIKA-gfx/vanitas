<!--
	스토리 길잡이 — 읽는 순서 (docs/008 5장). 공개순 ↔ 작중 시간순, 메인은 "여기까지 봤어요", 이벤트는 읽음 체크.
	제목·날짜는 스포일러가 아니라고 보고 진행도와 상관없이 모두 보인다 (서버가 그린 HTML에도 들어간다, 8-1).
	불확실한 정보는 감추지 않고 표시한다: 확인 전(verified: false), 작중순에서 추정(inferred), 날짜·시점 미확인 묶음
-->
<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { formatDate } from '$lib/format';
	import Badge from '$lib/components/Badge.svelte';
	import CheckboxField from '$lib/components/CheckboxField.svelte';
	import Panel from '$lib/components/Panel.svelte';
	import SegmentedField from '$lib/components/SegmentedField.svelte';
	import {
		isMain,
		orderUnits,
		readAfterOf,
		type StoryOrder,
		type StoryUnit
	} from '$lib/story/story';
	import type { StoryDoc } from '$lib/story/types';

	interface Props {
		doc: StoryDoc;
		read: ReadonlySet<string>;
		order: StoryOrder;
		onOrder: (by: StoryOrder) => void;
		onMark: (mainId: string) => void;
		onEvent: (eventId: string, read: boolean) => void;
	}
	let { doc, read, order, onOrder, onMark, onEvent }: Props = $props();

	const sorted = $derived(orderUnits(doc, order));
	const volumeTitle = $derived(Object.fromEntries(doc.volumes.map((v) => [v.id, v.title])));
</script>

{#snippet card(unit: StoryUnit, n: number | null)}
	{@const after = readAfterOf(doc, unit, read)}
	<div class="flex items-start gap-3 rounded-lg border border-navy/10 bg-surface px-3 py-2.5">
		{#if n !== null}
			<span class="w-6 shrink-0 pt-0.5 text-right font-num text-sm text-navy">{n}</span>
		{/if}
		<div class="flex min-w-0 flex-1 flex-col gap-1">
			<div class="flex flex-wrap items-center gap-x-2 gap-y-1">
				<Badge>{isMain(unit) ? m.story_kind_main() : m.story_kind_event()}</Badge>
				<span class="font-bold text-ink">{unit.title}</span>
				{#if order === 'chrono' && unit.chronoCertainty === 'inferred'}
					<Badge>{m.story_chrono_inferred()}</Badge>
				{/if}
				{#if !unit.verified}
					<Badge>{m.story_unverified()}</Badge>
				{/if}
			</div>
			<p class="text-xs text-navy">
				{#if isMain(unit)}
					{m.story_volume_chapter({
						volume: volumeTitle[unit.volume] ?? '',
						chapter: unit.chapter
					})}
					·
				{/if}
				{unit.releasedKr
					? m.story_released({ date: formatDate(unit.releasedKr) })
					: m.story_released_unknown()}
			</p>
			{#if order === 'chrono' && unit.chronoNote}
				<p class="text-xs text-navy">{unit.chronoNote}</p>
			{/if}
			{#if after.length > 0}
				<p class="text-xs text-navy">
					{m.story_read_after()}:
					{#each after as a, i (a.id)}
						<span
							>{i > 0 ? ', ' : ' '}<span class={a.read ? '' : 'font-bold text-ink'}>{a.title}</span
							>{a.read ? ` (${m.story_read_after_done()})` : ''}</span
						>
					{/each}
				</p>
			{/if}
			{#if unit.replayable === 'no'}
				<p class="text-xs text-navy">{m.story_replay_no()}</p>
			{/if}
		</div>
		<div class="shrink-0 self-center">
			{#if isMain(unit)}
				{#if read.has(unit.id)}
					<span class="flex items-center gap-1 text-sm font-bold text-brand-strong">
						<svg
							viewBox="0 0 18 18"
							class="size-4"
							fill="none"
							stroke="currentColor"
							stroke-width="2.25"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"><path d="m4.5 9.5 3 3 6-6.5" /></svg
						>
						{m.story_main_read()}
					</span>
				{:else}
					<button
						type="button"
						class="min-h-11 px-1 text-sm font-bold text-brand-strong hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-strong xl:min-h-8"
						aria-label={m.story_main_mark_label({ title: unit.title })}
						onclick={() => onMark(unit.id)}
					>
						{m.story_main_mark()}
					</button>
				{/if}
			{:else}
				<CheckboxField
					label={m.story_event_read()}
					ariaLabel={m.story_event_read_label({ title: unit.title })}
					bind:checked={() => read.has(unit.id), (v) => onEvent(unit.id, v)}
				/>
			{/if}
		</div>
	</div>
{/snippet}

<Panel>
	<div class="flex flex-col gap-4">
		<SegmentedField
			label={m.story_sort_label()}
			bind:value={() => order, (v) => onOrder(v as StoryOrder)}
			options={[
				{ value: 'release', label: m.story_sort_release() },
				{ value: 'chrono', label: m.story_sort_chrono() }
			]}
		/>
		<ol class="flex flex-col gap-2">
			{#each sorted.ordered as unit, i (unit.id)}
				<li>{@render card(unit, i + 1)}</li>
			{/each}
		</ol>
		{#if sorted.unknown.length > 0}
			<section class="flex flex-col gap-2">
				<h2 class="text-sm font-bold text-navy">
					{order === 'release' ? m.story_unknown_release() : m.story_unknown_chrono()}
				</h2>
				<ul class="flex flex-col gap-2">
					{#each sorted.unknown as unit (unit.id)}
						<li>{@render card(unit, null)}</li>
					{/each}
				</ul>
			</section>
		{/if}
	</div>
</Panel>
