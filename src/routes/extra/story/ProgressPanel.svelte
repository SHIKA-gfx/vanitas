<!--
	스토리 길잡이의 진행도 판 (docs/008 5장, 결정 D5): 메인 스토리 [권 ▾] [장 ▾]까지 봤어요.
	권을 고르면 그 권의 첫 장으로 — 더 적게 보이는 쪽이 스포일러에 안전하다. "아직 안 봤어요"는 진행도 없음.
	메인 목록은 읽는 순서(권 순서가 아니다, docs/008 6-2)라, 고른 장보다 앞의 장을 모두 본 것으로 친다는 것을 늘 알린다
	이벤트는 읽는 순서에서 체크한다 (여기에는 개수만). 메인 장은 읽는 순서의 체크박스로도 정할 수 있다 (2026-11-17)
-->
<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import Panel from '$lib/components/Panel.svelte';
	import SelectField from '$lib/components/SelectField.svelte';
	import { volumesWithChapters } from '$lib/story/story';
	import type { StoryDoc } from '$lib/story/types';

	interface Props {
		doc: StoryDoc;
		mainUpTo: string | null;
		eventsRead: number;
		onPick: (id: string | null) => void;
	}
	let { doc, mainUpTo, eventsRead, onPick }: Props = $props();

	const volumes = $derived(volumesWithChapters(doc));
	const current = $derived(doc.main.find((u) => u.id === mainUpTo));
	const volumeId = $derived(current?.volume ?? '');
	const chapters = $derived(volumes.find((v) => v.volume.id === volumeId)?.chapters ?? []);
	const readCount = $derived(current ? doc.main.indexOf(current) + 1 : 0);

	function pickVolume(id: string) {
		if (id === volumeId) return;
		onPick(volumes.find((v) => v.volume.id === id)?.chapters[0].id ?? null);
	}
</script>

<Panel title={m.story_progress_title()}>
	<div class="flex flex-col gap-4">
		{#if volumes.length > 0}
			<div class="grid gap-4 sm:grid-cols-2">
				<SelectField
					label={m.story_volume_label()}
					bind:value={() => volumeId, pickVolume}
					options={[
						{ value: '', label: m.story_volume_none() },
						...volumes.map((v) => ({ value: v.volume.id, label: v.volume.title }))
					]}
				/>
				{#if current}
					<SelectField
						label={m.story_chapter_label()}
						bind:value={() => mainUpTo ?? '', (id) => onPick(id)}
						options={chapters.map((c) => ({
							value: c.id,
							label: m.story_chapter_option({ chapter: c.chapter, title: c.title })
						}))}
					/>
				{/if}
			</div>
		{/if}
		<div class="flex flex-col gap-1 text-sm">
			<p class="font-bold text-ink">
				{m.story_progress_summary({
					read: readCount,
					total: doc.main.length,
					events: eventsRead
				})}
			</p>
			<p class="text-xs text-navy">{m.story_main_hint()}</p>
			<p class="text-xs text-navy">{m.story_events_hint()}</p>
		</div>
	</div>
</Panel>
