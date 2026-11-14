<!--
	데이터 문서 고치기 (docs/006 6-3-3, ④-4). 묶음(계산기별) 하나의 칸들을 값의 모양에 맞는 편집기로 (FieldRow).
	- 칸을 더하거나 빼는 모양 바꾸기는 "JSON 원문"으로 — 문서 전체를 글자로 고친다
	- 저장 전에 빌드와 같은 검사(validate.py)를 브라우저에서 돌린다: 고치기 전(지금 DB)과 뒤를 비교해
	  새 오류가 있으면 저장하지 않고, 새 경고·형이 바뀐 곳은 확인을 받는다
	- 그사이 다른 저장이 문서를 바꿨으면 DB 함수가 멈춘다 (판 비교)
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import Badge from '$lib/components/Badge.svelte';
	import CheckboxField from '$lib/components/CheckboxField.svelte';
	import Panel from '$lib/components/Panel.svelte';
	import SegmentedField from '$lib/components/SegmentedField.svelte';
	import { rowsToFiles } from '$lib/data/db/convert';
	import { formatJson } from '$lib/data/db/format-json';
	import type { GameDataRows } from '$lib/data/db/rows';
	import AdminButton from './AdminButton.svelte';
	import CheckReport from './CheckReport.svelte';
	import FieldRow from './FieldRow.svelte';
	import type { DatasetVersion } from './admin-data';
	import { diffChecks, runBuildCheck, type CheckDiff } from './build-check';
	import { provideInvalidSet } from './doc-context';
	import {
		changedPaths,
		copyOf,
		isPlaceholder,
		parseJsonText,
		typeChanges,
		type JsonObject
	} from './doc-edit';
	import { TABLED, TOP_LABELS, type DocSection } from './doc-sections';
	import { formatKst } from './admin-data';

	interface Props {
		section: DocSection;
		version: DatasetVersion;
		/** 이 문서의 묶음 칸이 사이트와 다른가 */
		pending: boolean;
		getRows: () => Promise<GameDataRows>;
		save: (path: string, doc: JsonObject, expected: string, deploy: boolean) => Promise<void>;
		cancel: () => void;
	}
	let { section, version, pending, getRows, save, cancel }: Props = $props();

	// 편집기는 묶음마다 새로 만든다 (AdminHome의 {#key}) — 처음 값만 읽는다
	const start = untrack(() => ({
		path: section.path,
		expected: version.updated_at,
		original: copyOf(version.data) as JsonObject
	}));
	let draft = $state(copyOf(start.original));
	const invalid = provideInvalidSet();
	let mode = $state<'form' | 'json'>('form');
	let jsonText = $state('');
	let jsonError = $state<string | null>(null);
	/** 칸으로 돌아가지 못했을 때 고르기 칸을 다시 그려 지금 방법(JSON)으로 되돌린다 */
	let modeKey = $state(0);
	let deploy = $state(true);
	let phase = $state<'idle' | 'checking' | 'review' | 'saving'>('idle');
	let review = $state<{ diff: CheckDiff | null; checkError: string | null; text: string } | null>(
		null
	);
	let error = $state<string | null>(null);

	const current = $derived($state.snapshot(draft as unknown) as JsonObject);
	const changes = $derived(changedPaths(start.original, current));
	const types = $derived(typeChanges(start.original, current));
	const tabledKeys = Object.keys(TABLED)
		.filter((k) => k.startsWith(`${start.path}:`))
		.map((k) => k.slice(start.path.length + 1));
	/** 검사한 뒤 또 고쳤으면 검사 결과는 지난 것 */
	const reviewed = $derived(
		phase === 'review' && review !== null && review.text === JSON.stringify(current)
	);
	const busy = $derived(phase === 'checking' || phase === 'saving');

	function switchMode(next: 'form' | 'json') {
		if (next === mode) return;
		if (next === 'json') {
			jsonText = formatJson(current);
			jsonError = null;
			mode = 'json';
			return;
		}
		if (applyJson()) mode = 'form';
		else modeKey++;
	}

	/** JSON 원문을 읽어 편집 중인 문서로. 자리 표시는 그대로 있어야 한다 */
	function applyJson(): boolean {
		const parsed = parseJsonText(jsonText);
		if (!parsed.ok) {
			jsonError = parsed.message;
			return false;
		}
		const lost = tabledKeys.filter((k) => !isPlaceholder(parsed.value[k]));
		if (lost.length > 0) {
			jsonError = `${lost.join(', ')} 자리 표시({"$table": …})는 그대로 둬요 — 그 내용은 위쪽 탭에서 고쳐요`;
			return false;
		}
		jsonError = null;
		invalid.clear();
		draft = parsed.value;
		return true;
	}

	async function checkAndSave() {
		if (busy) return;
		if (mode === 'json' && !applyJson()) return;
		error = null;
		phase = 'checking';
		const doc = $state.snapshot(draft as unknown) as JsonObject;
		let before;
		let after;
		try {
			const rows = await getRows();
			before = rowsToFiles(rows);
			after = rowsToFiles({
				...rows,
				datasets: rows.datasets.map((d) =>
					d.path === start.path ? { path: d.path, data: doc } : d
				)
			});
		} catch (e) {
			error = `문서를 파일로 바꾸지 못했어요: ${(e as Error).message}`;
			phase = 'idle';
			return;
		}
		let diff: CheckDiff | null = null;
		let checkError: string | null = null;
		try {
			diff = diffChecks(await runBuildCheck(before), await runBuildCheck(after));
		} catch (e) {
			checkError = (e as Error).message;
		}
		const clean =
			diff !== null &&
			diff.newErrors.length === 0 &&
			diff.newWarnings.length === 0 &&
			types.length === 0;
		if (clean) return doSave(doc);
		review = { diff, checkError, text: JSON.stringify(doc) };
		phase = 'review';
	}

	async function doSave(doc: JsonObject) {
		phase = 'saving';
		error = null;
		try {
			await save(start.path, doc, start.expected, deploy);
		} catch (e) {
			error = (e as Error).message;
			phase = 'idle';
		}
	}
</script>

<Panel title={section.title}>
	<div class="flex flex-col gap-5">
		<div class="flex flex-col gap-1">
			<p class="text-sm text-ink">{section.description}</p>
			<p class="flex flex-wrap items-center gap-2 text-xs text-navy">
				<span class="font-mono">{start.path}</span>
				<span>· DB 저장 {formatKst(start.expected)}</span>
				{#if pending}<Badge>반영 전</Badge>{/if}
			</p>
		</div>

		{#key modeKey}
			<SegmentedField
				label="고치는 방법"
				bind:value={() => mode, (v) => switchMode(v as 'form' | 'json')}
				options={[
					{ value: 'form', label: '칸으로 고치기' },
					{ value: 'json', label: 'JSON 원문' }
				]}
			/>
		{/key}

		{#if mode === 'form'}
			<div class="flex flex-col gap-3">
				{#each section.keys as key (key)}
					<FieldRow parent={draft} {key} labelText={TOP_LABELS[`${start.path}:${key}`]} />
				{/each}
			</div>
			<p class="text-xs text-navy">
				칸을 더하거나 빼는 것(모양 바꾸기)은 "JSON 원문"에서 해요. 목록의 줄은 여기서 더하고 뺄 수
				있어요
			</p>
		{:else}
			<div class="flex flex-col gap-2">
				<textarea
					class="field h-auto min-h-[28rem] py-3 font-mono text-xs leading-relaxed {jsonError
						? 'field-error'
						: ''}"
					spellcheck="false"
					aria-label="{start.path} JSON 원문"
					bind:value={jsonText}></textarea>
				{#if jsonError}
					<p role="alert" class="text-sm font-bold text-blocked">{jsonError}</p>
				{/if}
				<p class="text-xs text-navy">
					문서 전체예요 ({start.path}). "칸으로 고치기"로 돌아가거나 저장하면 읽어 들여요
				</p>
			</div>
		{/if}

		{#if changes.length > 0}
			<details class="text-xs text-navy">
				<summary class="cursor-pointer font-medium">바뀐 곳 {changes.length}곳</summary>
				<ul class="mt-1 list-disc pl-5 font-mono break-all">
					{#each changes.slice(0, 30) as p, i (i)}<li>{p}</li>{/each}
					{#if changes.length > 30}<li>… 외 {changes.length - 30}곳</li>{/if}
				</ul>
			</details>
		{/if}
		{#if types.length > 0}
			<div class="text-xs text-ink">
				<p class="font-bold">형이 바뀐 곳 (숫자 ↔ 글자 등) — 의도한 것인지 봐요</p>
				<ul class="list-disc pl-5 font-mono break-all">
					{#each types as t, i (i)}<li>{t}</li>{/each}
				</ul>
			</div>
		{/if}

		<CheckboxField label="저장하면 배포 요청" bind:checked={deploy} />

		{#if phase === 'checking'}
			<p role="status" class="text-sm text-navy">
				빌드 검사 중… 처음에는 검사 도구(약 12MB)를 받느라 10초쯤 걸려요
			</p>
		{/if}
		{#if reviewed && review}
			{#if review.diff}
				<CheckReport diff={review.diff} />
			{/if}
			{#if review.checkError}
				<p role="alert" class="text-sm font-bold text-blocked">
					빌드 검사를 돌리지 못했어요: {review.checkError}
				</p>
			{/if}
		{/if}
		{#if invalid.size > 0}
			<p class="text-sm font-bold text-blocked">
				빨간 칸 {invalid.size}곳을 고쳐야 저장할 수 있어요
			</p>
		{/if}
		{#if error}
			<p role="alert" class="text-sm font-bold text-blocked">저장하지 못했어요: {error}</p>
		{/if}

		<div class="flex flex-wrap items-center gap-y-3">
			{#if reviewed && review && (review.diff ? review.diff.newErrors.length === 0 : true)}
				<AdminButton
					variant="primary"
					disabled={busy}
					onclick={() => {
						if (
							review?.checkError &&
							!confirm('검사 없이 저장할까요? 빌드에서 막히면 사이트는 이전 데이터에 남아요')
						)
							return;
						doSave(JSON.parse(review!.text));
					}}
				>
					{phase === 'saving'
						? '저장하는 중…'
						: review.checkError
							? '검사 없이 저장'
							: '확인했어요, 저장'}
				</AdminButton>
			{:else}
				<AdminButton
					variant="primary"
					disabled={busy || changes.length === 0 || invalid.size > 0}
					onclick={checkAndSave}
				>
					{phase === 'checking'
						? '검사하는 중…'
						: phase === 'saving'
							? '저장하는 중…'
							: changes.length === 0
								? '바뀐 곳 없음'
								: '검사하고 저장'}
				</AdminButton>
			{/if}
			<AdminButton onclick={cancel} disabled={busy}>취소</AdminButton>
		</div>
	</div>
</Panel>
