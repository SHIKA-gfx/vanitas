<!--
	스토리 길잡이 — 스포일러 안전 사전 (docs/008 5장, 결정 D6·D7).
	보이는 항목·블록·이름은 visibleEntries가 정한다. 여기서는 그 결과만 그린다:
	- 진행도를 읽기 전(ready 전)에는 아무것도 그리지 않는다 — 서버가 그린 HTML에 설명이 들어가지 않게 (8-1)
	- 숨은 블록이 있는지·몇 개인지는 보이지 않는다 (D6). 상세 페이지 없이 목록 안에서 펼친다 (D7)
	- 찾기·종류 거르기도 보이는 이름·설명에서만 — 아직 모르는 이름으로 찾으면 그냥 "없어요"
	- 관련 항목을 누르면 그 항목을 펼치고 그 자리로 옮긴다
-->
<script lang="ts">
	import { tick } from 'svelte';
	import { m } from '$lib/paraglide/messages.js';
	import Panel from '$lib/components/Panel.svelte';
	import SegmentedField from '$lib/components/SegmentedField.svelte';
	import { visibleEntries } from '$lib/story/story';
	import type { EntryType, StoryDoc } from '$lib/story/types';
	import { reducedMotion } from '$lib/motion';

	interface Props {
		doc: StoryDoc;
		read: ReadonlySet<string>;
		ready: boolean;
	}
	let { doc, read, ready }: Props = $props();
	const uid = $props.id();

	const TYPE_LABEL: Record<EntryType, () => string> = {
		person: m.story_type_person,
		group: m.story_type_group,
		place: m.story_type_place,
		term: m.story_type_term
	};

	let query = $state('');
	let type = $state('all');
	let open = $state<Record<string, boolean>>({});

	const entries = $derived(ready ? visibleEntries(doc, read) : []);
	const filtered = $derived.by(() => {
		const q = query.trim().toLocaleLowerCase();
		return entries.filter(
			(e) =>
				(type === 'all' || e.entryType === type) &&
				(!q ||
					e.name.toLocaleLowerCase().includes(q) ||
					e.texts.some((t) => t.toLocaleLowerCase().includes(q)))
		);
	});

	async function goTo(id: string) {
		query = '';
		type = 'all';
		open[id] = true;
		await tick();
		const el = document.getElementById(`${uid}-${id}`);
		el?.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
		el?.querySelector('button')?.focus({ preventScroll: true });
	}
</script>

<Panel>
	{#if !ready}
		<p class="text-sm text-navy">{m.story_dict_loading()}</p>
	{:else if read.size === 0}
		<p class="leading-relaxed text-ink">{m.story_dict_locked()}</p>
	{:else}
		<div class="flex flex-col gap-4">
			<div>
				<label
					for="{uid}-q"
					class="mb-2 flex min-h-6 items-center gap-2 text-[0.8125rem] font-medium text-navy"
				>
					<span
						aria-hidden="true"
						class="h-3 w-[3px] shrink-0 -skew-x-30 rounded-[1px_1.5px] bg-brand"
					></span>
					{m.story_dict_search()}
				</label>
				<input id="{uid}-q" type="search" class="field" bind:value={query} />
			</div>
			<SegmentedField
				label={m.story_dict_filter()}
				bind:value={type}
				options={[
					{ value: 'all', label: m.story_type_all() },
					...(Object.keys(TYPE_LABEL) as EntryType[]).map((t) => ({
						value: t,
						label: TYPE_LABEL[t]()
					}))
				]}
			/>
			{#if filtered.length === 0}
				<p class="text-sm text-navy">{m.story_dict_none()}</p>
			{:else}
				<ul class="flex flex-col gap-2">
					{#each filtered as entry (entry.id)}
						<li id="{uid}-{entry.id}" class="rounded-lg border border-navy/10 bg-surface">
							<button
								type="button"
								class="flex min-h-11 w-full items-center gap-2 px-3 text-left focus-visible:outline-2 focus-visible:outline-brand-strong"
								aria-expanded={open[entry.id] ?? false}
								onclick={() => (open[entry.id] = !open[entry.id])}
							>
								<span aria-hidden="true" class="text-xs text-navy"
									>{open[entry.id] ? '▾' : '▸'}</span
								>
								<span class="font-bold text-ink">{entry.name}</span>
								<span class="text-xs text-navy">{TYPE_LABEL[entry.entryType]()}</span>
							</button>
							{#if open[entry.id]}
								<div class="flex flex-col gap-2 border-t border-navy/10 px-3 py-3">
									{#each entry.texts as text, i (i)}
										<p class="leading-relaxed whitespace-pre-line text-ink">{text}</p>
									{/each}
									{#if entry.related.length > 0}
										<p class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-navy">
											{m.story_dict_related()}:
											{#each entry.related as r (r.id)}
												<button
													type="button"
													class="font-bold text-brand-strong underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-brand-strong"
													onclick={() => goTo(r.id)}>{r.name}</button
												>
											{/each}
										</p>
									{/if}
								</div>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}
</Panel>
