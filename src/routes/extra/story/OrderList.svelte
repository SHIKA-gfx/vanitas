<!--
	스토리 길잡이 — 읽는 순서 (docs/008 5장). 공개순 ↔ 작중 시간순.
	제목·날짜는 스포일러가 아니라고 보고 진행도와 상관없이 모두 보인다 (서버가 그린 HTML에도 들어간다, 8-1).
	불확실한 정보는 감추지 않고 표시한다: 확인 전(verified: false), 작중순에서 추정(inferred — 모두 추정이면 목록 위 한 줄), 날짜·시점 미확인 묶음

	2026-11-17 (D12~D14):
	- 이미 본 쪽은 접는다 — 본 메인 장과 그 지점까지의 이벤트를 한 줄("이미 본 스토리 N개") 안으로. 그 안에 안 본 이벤트가 있으면 줄에 알린다.
	  나누는 규칙은 story.ts splitByProgress. 접힘 여부는 저장하지 않는다 (들어올 때마다 접혀 있다)
	- 메인·이벤트는 종류 색으로 구분: 메인은 navy 진하게(왼쪽 띠 + 채운 배지), 이벤트는 옅게(옅은 띠 + 테두리 배지). 배지 글자가 늘 뜻을 말한다
	- 봤는지 표시는 메인·이벤트 모두 체크박스 하나 — 꺼짐 "아직 안 봤어요", 켜짐 "봤어요".
	  메인은 진행도가 "이 장까지"라서, 켜면 읽는 순서가 앞인 장도 함께 켜지고 끄면 그 장부터 뒤가 꺼진다
-->
<script lang="ts">
	import { tick } from 'svelte';
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
		splitByProgress,
		type StoryOrder,
		type StoryUnit
	} from '$lib/story/story';
	import type { StoryDoc } from '$lib/story/types';

	interface Props {
		doc: StoryDoc;
		read: ReadonlySet<string>;
		order: StoryOrder;
		onOrder: (by: StoryOrder) => void;
		/** 메인 장의 봤어요를 켜거나 끈다 (끄면 바로 앞 장까지로 — 부모가 정한다) */
		onMain: (mainId: string, seen: boolean) => void;
		onEvent: (eventId: string, seen: boolean) => void;
	}
	let { doc, read, order, onOrder, onMain, onEvent }: Props = $props();

	const uid = $props.id();
	const sorted = $derived(orderUnits(doc, order));
	const split = $derived(splitByProgress(sorted.ordered, read));
	/** 접어도 번호는 전체 목록에서의 자리 그대로 (앞으로 볼 쪽이 24번부터 시작하는 식) */
	const position = $derived(new Map(sorted.ordered.map((u, i) => [u.id, i + 1])));
	const volumeTitle = $derived(Object.fromEntries(doc.volumes.map((v) => [v.id, v.title])));
	/** 장이 하나뿐인 권(프롤로그 등)은 "N장"을 붙이지 않는다 */
	const singleChapter = $derived(
		new Set(
			doc.volumes
				.filter((v) => doc.main.filter((u) => u.volume === v.id).length === 1)
				.map((v) => v.id)
		)
	);
	/**
	 * 작중순이 모두 추정이면 카드마다 배지를 달지 않고 목록 위 한 줄로 알린다 (2026-11-16 — 82개 카드가 모두 "순서 추정"이면 소음).
	 * 공식 확인(stated)과 섞이면 추정인 카드에만 배지
	 */
	const allInferred = $derived(sorted.ordered.every((u) => u.chronoCertainty === 'inferred'));

	let pastOpen = $state(false);
	let listEl = $state<HTMLElement>();
	let toggleEl = $state<HTMLButtonElement>();

	/**
	 * 메인 장을 켜거나 끄면 그 줄이 접힌 쪽 ↔ 앞으로 볼 쪽으로 옮겨 가며 다시 그려진다.
	 * 초점이 사라지지 않게 옮겨 간 줄로, 접혀 있어 안 보이면 접힌 줄 머리로 옮긴다 (화면도 따라간다)
	 */
	async function markMain(id: string, seen: boolean) {
		onMain(id, seen);
		await tick();
		const box = listEl?.querySelector<HTMLInputElement>(`[data-unit="${CSS.escape(id)}"] input`);
		(box ?? toggleEl)?.focus();
	}
</script>

{#snippet card(unit: StoryUnit)}
	{@const after = readAfterOf(doc, unit, read)}
	{@const main = isMain(unit)}
	{@const n = position.get(unit.id)}
	<div
		class="flex items-start gap-3 rounded-lg border border-l-4 border-navy/10 bg-surface px-3 py-2.5 {main
			? 'border-l-navy'
			: 'border-l-navy/25'}"
	>
		{#if n !== undefined}
			<span class="w-6 shrink-0 pt-0.5 text-right font-num text-sm text-navy">{n}</span>
		{/if}
		<!-- 좁은 화면은 봤어요 줄을 내용 아래로 — 옆에 두면 제목이 들어갈 폭이 110px쯤밖에 안 남는다 -->
		<div class="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-center sm:gap-3">
			<div class="flex min-w-0 flex-1 flex-col gap-1">
				<div class="flex flex-wrap items-center gap-x-2 gap-y-1">
					<Badge tone={main ? 'solid' : 'neutral'}
						>{main ? m.story_kind_main() : m.story_kind_event()}</Badge
					>
					<span class="font-bold text-ink">{unit.title}</span>
					{#if order === 'chrono' && unit.chronoCertainty === 'inferred' && !allInferred}
						<Badge>{m.story_chrono_inferred()}</Badge>
					{/if}
					{#if !unit.verified}
						<Badge>{m.story_unverified()}</Badge>
					{/if}
				</div>
				<p class="text-xs text-navy">
					{#if isMain(unit)}
						{singleChapter.has(unit.volume)
							? (volumeTitle[unit.volume] ?? '')
							: m.story_volume_chapter({
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
								>{i > 0 ? ', ' : ' '}<span class={a.read ? '' : 'font-bold text-ink'}
									>{a.title}</span
								>{a.read ? ` (${m.story_read_after_done()})` : ''}</span
							>
						{/each}
					</p>
				{/if}
				{#if unit.replayable === 'no'}
					<p class="text-xs text-navy">{m.story_replay_no()}</p>
				{/if}
			</div>
			<!-- 넓은 화면은 폭을 고정해 "아직 안 봤어요" ↔ "봤어요"로 글자 길이가 바뀌어도 체크박스가 세로로 한 줄에 선다 -->
			<div class="shrink-0 sm:w-[7.75rem]" data-unit={unit.id}>
				<CheckboxField
					emphasis
					label={read.has(unit.id) ? m.story_seen() : m.story_unseen()}
					ariaLabel={main
						? m.story_main_seen_label({ title: unit.title })
						: m.story_event_seen_label({ title: unit.title })}
					bind:checked={
						() => read.has(unit.id), (v) => (main ? markMain(unit.id, v) : onEvent(unit.id, v))
					}
				/>
			</div>
		</div>
	</div>
{/snippet}

<Panel>
	<div class="flex flex-col gap-4" bind:this={listEl}>
		<SegmentedField
			label={m.story_sort_label()}
			bind:value={() => order, (v) => onOrder(v as StoryOrder)}
			options={[
				{ value: 'release', label: m.story_sort_release() },
				{ value: 'chrono', label: m.story_sort_chrono() }
			]}
		/>
		{#if order === 'chrono' && allInferred && sorted.ordered.length > 0}
			<p class="text-xs text-navy">{m.story_chrono_all_inferred()}</p>
		{/if}

		{#if split.past.length > 0}
			<div class="rounded-lg border border-navy/15 bg-wash">
				<button
					bind:this={toggleEl}
					type="button"
					class="flex min-h-11 w-full flex-wrap items-center gap-x-3 gap-y-0.5 rounded-lg px-3 py-2 text-left focus-visible:outline-2 focus-visible:outline-brand-strong"
					aria-expanded={pastOpen}
					aria-controls="{uid}-past"
					onclick={() => (pastOpen = !pastOpen)}
				>
					<span class="flex items-center gap-2">
						<span aria-hidden="true" class="text-xs text-navy">{pastOpen ? '▾' : '▸'}</span>
						<span class="font-bold text-ink"
							>{m.story_past_toggle({ count: split.past.length })}</span
						>
					</span>
					{#if split.pastUnseenEvents > 0}
						<span class="pl-5 text-sm font-bold text-brand-strong sm:pl-0">
							{m.story_past_unseen_events({ count: split.pastUnseenEvents })}
						</span>
					{/if}
				</button>
				<ol
					id="{uid}-past"
					hidden={!pastOpen}
					class="flex flex-col gap-2 border-t border-navy/10 p-2"
				>
					{#if pastOpen}
						{#each split.past as unit (unit.id)}
							<li>{@render card(unit)}</li>
						{/each}
					{/if}
				</ol>
			</div>
		{/if}

		{#if split.ahead.length > 0}
			<ol class="flex flex-col gap-2">
				{#each split.ahead as unit (unit.id)}
					<li>{@render card(unit)}</li>
				{/each}
			</ol>
		{:else if sorted.ordered.length > 0}
			<p class="text-sm text-navy">{m.story_ahead_empty()}</p>
		{/if}

		{#if sorted.unknown.length > 0}
			<section class="flex flex-col gap-2">
				<h2 class="text-sm font-bold text-navy">
					{order === 'release' ? m.story_unknown_release() : m.story_unknown_chrono()}
				</h2>
				<ul class="flex flex-col gap-2">
					{#each sorted.unknown as unit (unit.id)}
						<li>{@render card(unit)}</li>
					{/each}
				</ul>
			</section>
		{/if}
	</div>
</Panel>
