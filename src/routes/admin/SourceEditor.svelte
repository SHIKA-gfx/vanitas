<!--
	출처 더하기·고치기 (docs/006 6-3, ④-3). 저장은 DB 함수 save_source 하나 (배포 요청도 같은 저장).
	- 새 출처의 번호는 저장할 때 DB가 정한다 (다음 번호를 미리 보여 준다)
	- 출처는 지우지 않는다 — 예전 값의 근거로 남긴다
	- 공지된 기간에는 공식(official) 출처가 하나 있어야 한다 (기간 저장 전 검사)
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import CheckboxField from '$lib/components/CheckboxField.svelte';
	import DateField from '$lib/components/DateField.svelte';
	import Panel from '$lib/components/Panel.svelte';
	import SegmentedField from '$lib/components/SegmentedField.svelte';
	import type { SourceEntry } from '$lib/data/db/convert';
	import AdminButton from './AdminButton.svelte';
	import TextField from './TextField.svelte';
	import {
		TIER_LABEL,
		draftToSource,
		emptySourceDraft,
		nextSourceId,
		sourceDraftFrom,
		validateSource,
		type Tier
	} from './catalog-edit';
	import { todayKst } from './recruit-edit';

	interface Props {
		/** 고치는 출처의 id. null이면 새 출처 */
		id: string | null;
		sources: Record<string, SourceEntry>;
		/** 이 출처를 쓰는 기간 id */
		usedBy: string[];
		save: (id: string | null, source: SourceEntry, deploy: boolean) => Promise<void>;
		cancel: () => void;
	}
	let { id, sources, usedBy, save, cancel }: Props = $props();

	// 편집기는 출처마다 새로 만든다 (AdminHome의 {#key}) — 처음 값만 읽는다
	const initial = untrack(() => ({
		id,
		next: nextSourceId(Object.keys(sources)),
		draft: id ? sourceDraftFrom(sources[id]) : emptySourceDraft(todayKst())
	}));
	let draft = $state(initial.draft);
	let deploy = $state(true);
	let pending = $state(false);
	let error = $state<string | null>(null);

	const issues = $derived(validateSource(draft));
	const errors = $derived(issues.filter((i) => i.level === 'error'));
	const fieldError = (field: string) =>
		issues.find((i) => i.level === 'error' && i.field === field)?.message;
	const urlWarning = $derived(issues.find((i) => i.level === 'warning')?.message);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (pending || errors.length > 0) return;
		pending = true;
		error = null;
		try {
			await save(initial.id, draftToSource(draft), deploy);
		} catch (e) {
			error = (e as Error).message;
			pending = false;
		}
	}
</script>

<Panel title={initial.id ? `출처 ${initial.id} 고치기` : `새 출처 (${initial.next}번)`}>
	<form onsubmit={submit} class="flex flex-col gap-5">
		<SegmentedField
			label="등급"
			bind:value={draft.tier}
			options={(Object.keys(TIER_LABEL) as Tier[]).map((t) => ({ value: t, label: TIER_LABEL[t] }))}
		/>
		<p class="-mt-3 text-xs text-navy">
			공식 = 게임 안 공지·공식 방송·공식 계정, 언론 = 기사, 커뮤니티 = 정리글·위키. 공지된 기간에는
			공식 출처가 하나 있어야 해요
		</p>
		<TextField
			label="발행처"
			bind:value={draft.publisher}
			hint="예: 넥슨 (공식 공지), 디스이즈게임, 나무위키"
		/>
		<TextField label="제목" bind:value={draft.title} />
		<div class="grid gap-5 sm:grid-cols-2">
			<TextField
				label="발행일"
				bind:value={draft.date}
				hint="YYYY-MM-DD (연도·연월만도 돼요). 모르면 비움"
				error={fieldError('date')}
			/>
			<DateField
				label="확인한 날"
				bind:value={draft.retrievedAt}
				error={fieldError('retrievedAt')}
			/>
		</div>
		<TextField
			label="주소"
			type="text"
			bind:value={draft.url}
			hint={urlWarning ?? '공지·기사·영상의 주소'}
			error={fieldError('url')}
		/>
		<TextField label="메모" bind:value={draft.note} multiline />
		{#if usedBy.length > 0}
			<p class="text-xs text-navy">
				쓰는 기간: <span class="font-mono break-all">{usedBy.join(', ')}</span>
			</p>
		{/if}
		<CheckboxField label="저장하면 배포 요청" bind:checked={deploy} />

		{#if errors.length > 0}
			<div class="text-xs text-navy">
				<p class="font-bold">저장하려면</p>
				<ul class="mt-1 list-disc pl-5">
					{#each errors as issue, i (i)}
						<li>{issue.message}</li>
					{/each}
				</ul>
			</div>
		{/if}
		{#if error}
			<p role="alert" class="text-sm font-bold text-blocked">저장하지 못했어요: {error}</p>
		{/if}
		<div class="flex flex-wrap items-center gap-y-3">
			<AdminButton variant="primary" type="submit" disabled={pending || errors.length > 0}>
				{pending ? '저장하는 중…' : '저장'}
			</AdminButton>
			<AdminButton onclick={cancel} disabled={pending}>취소</AdminButton>
		</div>
	</form>
</Panel>
