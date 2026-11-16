<!--
	/ko/extra/story — 스토리 길잡이 (2026-11-16, docs/008 5장).
	어디까지 봤는지(진행도)를 정하면, 그 지점까지 밝혀진 내용만 보인다. 계산은 src/lib/story/story.ts.

	- 진행도는 저장 묶음 story (docs/008 9장) — 브라우저 저장·계정 맞추기·백업 링크로 이어진다. 공유 링크는 만들지 않는다
	  (남의 진행도로 보면 스포일러가 된다). 칸 검사는 형까지만 하고, 없는 id는 불러올 때 normalizeSave가 뺀다
	- 사전은 브라우저에서 진행도를 읽은 뒤에만 그린다 (8-1) — 서버가 그린 HTML에는 진행도 판과 스토리 목록(제목·날짜)만
	- 스토리 정보가 아직 없으면 모으는 중이라는 안내만
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '$lib/paraglide/messages.js';
	import { track } from '$lib/analytics';
	import Seo from '$lib/components/Seo.svelte';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import Panel from '$lib/components/Panel.svelte';
	import SegmentedField from '$lib/components/SegmentedField.svelte';
	import { isOneOf } from '$lib/state/persist';
	import { persistSection } from '$lib/state/saved.svelte';
	import { storyDoc } from '$lib/story/data';
	import { EMPTY_SAVE, normalizeSave, readSet, type StoryOrder } from '$lib/story/story';
	import ProgressPanel from './ProgressPanel.svelte';
	import OrderList from './OrderList.svelte';
	import Dictionary from './Dictionary.svelte';

	const doc = storyDoc;
	const hasUnits = doc.main.length + doc.events.length > 0;

	let mainUpTo = $state<string | null>(EMPTY_SAVE.mainUpTo);
	let readEvents = $state<string[]>([]);
	let order = $state<StoryOrder>(EMPTY_SAVE.order);
	let tab = $state('order');
	/** 저장된 진행도를 읽었는가 — 그 전에는 사전을 그리지 않는다 */
	let mounted = $state(false);

	persistSection(
		'story',
		() => ({ mainUpTo, readEvents, order }),
		(v) => {
			const n = normalizeSave(doc, v);
			mainUpTo = n.mainUpTo;
			readEvents = n.readEvents;
			order = n.order;
		},
		() => ({ ...EMPTY_SAVE, readEvents: [] }),
		{
			mainUpTo: (v) => v === null || typeof v === 'string',
			readEvents: (v) => Array.isArray(v) && v.every((x) => typeof x === 'string'),
			order: isOneOf(['release', 'chrono'])
		}
	);
	// persistSection의 onMount(저장값 읽기)가 먼저 돈다
	onMount(() => (mounted = true));

	const read = $derived(readSet(doc, { mainUpTo, readEvents, order }));

	// 통계 (docs/008 10장): 진행도를 처음 정할 때 한 번(값은 담지 않는다), 정렬을 바꿀 때
	let progressTracked = false;
	function pickMain(id: string | null) {
		mainUpTo = id;
		if (progressTracked) return;
		progressTracked = true;
		track('story-progress', { has: id ? 'yes' : 'no' });
	}
	function pickOrder(by: StoryOrder) {
		if (by === order) return;
		order = by;
		track('story-order', { by });
	}
	function markEvent(id: string, on: boolean) {
		const next = on ? [...readEvents, id] : readEvents.filter((x) => x !== id);
		readEvents = normalizeSave(doc, { mainUpTo, readEvents: next, order }).readEvents;
	}
</script>

<Seo
	title={`${m.extra_story_title()} | ${m.app_title()}`}
	description={m.meta_story_description()}
/>

<main class="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
	<div class="flex flex-col gap-2">
		<PageTitle title={m.extra_story_title()} icon="story" />
		<!-- 배경 위 글자는 ink·navy만 (디자인 문서 5-19) -->
		<p class="text-navy">{m.story_intro()}</p>
	</div>

	{#if !hasUnits}
		<Panel>
			<p class="leading-relaxed text-ink">{m.story_empty()}</p>
		</Panel>
	{:else}
		<ProgressPanel {doc} {mainUpTo} eventsRead={readEvents.length} onPick={pickMain} />

		<SegmentedField
			label={m.story_tabs_label()}
			labelHidden
			bind:value={tab}
			options={[
				{ value: 'order', label: m.story_tab_order() },
				{ value: 'dictionary', label: m.story_tab_dictionary() }
			]}
		/>

		{#if tab === 'order'}
			<OrderList {doc} {read} {order} onOrder={pickOrder} onMark={pickMain} onEvent={markEvent} />
		{:else}
			<Dictionary {doc} {read} ready={mounted} />
		{/if}
	{/if}

	<p class="text-xs leading-relaxed text-navy">{m.story_notice()}</p>
</main>
