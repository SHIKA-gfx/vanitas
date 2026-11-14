<!--
	관리자 첫 화면 (docs/006 6-2). 왼쪽: 미래시·학생·출처·문서 (화면 안 탭) / 오른쪽: 변경 기록·배포.
	- 탭을 옮겨도 고치던 내용은 남는다 — 기간을 고치다 출처 탭에서 새 출처를 더하고 돌아오면 선택지에 바로 있다
	- 저장할 때마다 DB를 다시 읽고, 이 화면을 연 배포(=지금 사이트)와 비교해 "반영 전"을 알린다
-->
<script lang="ts">
	import type { SupabaseClient } from '@supabase/supabase-js';
	import { onMount, tick } from 'svelte';
	import SegmentedField from '$lib/components/SegmentedField.svelte';
	import type { SourceEntry } from '$lib/data/db/convert';
	import type { RecruitPeriod, Student } from '$lib/data/types';
	// 이 화면을 연 배포(=지금 사이트)에 들어 있는 데이터 — DB와 비교해 "반영 전"을 알린다
	import siteSchedule from '../../../data/ko/schedule.json';
	import siteStudents from '../../../data/ko/students.json';
	import siteSources from '../../../data/sources.json';
	import AdminButton from './AdminButton.svelte';
	import DocEditor from './DocEditor.svelte';
	import DocList from './DocList.svelte';
	import ChangeLogPanel from './ChangeLogPanel.svelte';
	import DeployPanel from './DeployPanel.svelte';
	import RecruitEditor from './RecruitEditor.svelte';
	import RecruitList from './RecruitList.svelte';
	import SourceEditor from './SourceEditor.svelte';
	import SourceList from './SourceList.svelte';
	import StudentEditor from './StudentEditor.svelte';
	import StudentList from './StudentList.svelte';
	import type {
		DatasetVersion,
		DeployRequest,
		RecruitOverview,
		SaveLog,
		SaveOptions
	} from './admin-data';
	import {
		loadAllRows,
		loadDatasets,
		saveDataset,
		deleteRecruit,
		deleteStudent,
		loadChangeLog,
		loadDeploys,
		loadRecruits,
		requestDeploy,
		saveRecruit,
		saveSource,
		saveStudent
	} from './admin-data';
	import { countUsage } from './catalog-edit';
	import { compareWithSite } from './recruit-edit';
	import { runBuildCheck } from './build-check';
	import { rowsToFiles } from '$lib/data/db/convert';
	import { ALL_SECTIONS, type DocSection } from './doc-sections';
	import type { JsonObject } from './doc-edit';
	import { SITE_FILES } from './site-data';

	let { sb, me }: { sb: SupabaseClient; me: string } = $props();

	const site = {
		recruits: siteSchedule.recruits as unknown as RecruitPeriod[],
		students: siteStudents.students as Student[],
		sources: Object.entries(siteSources.sources as unknown as Record<string, SourceEntry>).map(
			([id, s]) => ({ id, ...s })
		)
	};

	type Section = 'recruits' | 'students' | 'sources' | 'docs';
	let section = $state<Section>('recruits');
	let overview = $state<RecruitOverview | null>(null);
	let saves = $state<SaveLog[]>([]);
	let deploys = $state<DeployRequest[]>([]);
	let error = $state<string | null>(null);
	let notice = $state<string | null>(null);
	// 탭마다 편집 중인 것. undefined면 목록 (null은 "새로 만들기")
	let recruitEdit = $state<{ original: RecruitPeriod | null }>();
	let studentEdit = $state<{ original: Student | null }>();
	let sourceEdit = $state<{ id: string | null }>();
	let docEdit = $state<{ section: DocSection }>();
	/** 문서 10개 — 문서 탭을 처음 열 때 읽는다 */
	let docs = $state<DatasetVersion[] | null>(null);
	let docsError = $state<string | null>(null);

	const canonical = (v: unknown) =>
		JSON.stringify(v, (_k, x) =>
			x && typeof x === 'object' && !Array.isArray(x)
				? Object.fromEntries(
						Object.keys(x)
							.sort()
							.map((k) => [k, x[k]])
					)
				: x
		);
	/** 묶음 id → 사이트와 다른가 (묶음의 칸만 비교) */
	const docPending = $derived(
		new Set(
			docs === null
				? []
				: ALL_SECTIONS.filter((s) => {
						const db = docs?.find((d) => d.path === s.path)?.data;
						const site = SITE_FILES[s.path];
						return db && s.keys.some((k) => canonical(db[k]) !== canonical(site[k]));
					}).map((s) => s.id)
		)
	);

	const usage = $derived(overview ? countUsage(overview.recruits) : null);
	const sync = $derived(
		overview && {
			recruits: compareWithSite(overview.recruits, site.recruits),
			students: compareWithSite(overview.studentList, site.students),
			sources: compareWithSite(
				Object.entries(overview.sourceEntries).map(([id, s]) => ({ id, ...s })),
				site.sources
			)
		}
	);
	const tabs = $derived([
		{ value: 'recruits', label: `미래시 ${overview?.recruits.length ?? ''}` },
		{ value: 'students', label: `학생 ${overview?.studentList.length ?? ''}` },
		{ value: 'sources', label: `출처 ${Object.keys(overview?.sourceEntries ?? {}).length || ''}` },
		{ value: 'docs', label: '문서' }
	]);

	async function loadDocs() {
		docsError = null;
		try {
			docs = await loadDatasets(sb);
		} catch (e) {
			docsError = (e as Error).message;
		}
	}
	$effect(() => {
		if (section === 'docs' && docs === null && docsError === null) loadDocs();
	});

	async function load() {
		error = null;
		try {
			[overview, saves, deploys] = await Promise.all([
				loadRecruits(sb),
				loadChangeLog(sb),
				loadDeploys(sb)
			]);
		} catch (e) {
			error = (e as Error).message;
		}
	}

	/** 편집 화면을 연 뒤 화면 위로 (모바일은 목록이 길다) */
	async function opened() {
		notice = null;
		await tick();
		document.getElementById('admin-sections')?.scrollIntoView({ block: 'start' });
	}

	async function done(message: string, deploy: boolean) {
		notice = `${message}${deploy ? ' · 배포를 요청했어요 (1~2분)' : ''}`;
		// 기간 저장은 schedule.json(일정 확인일)도 바꾼다 → 문서도 다시 읽는다
		await Promise.all([load(), docs === null ? null : loadDocs()]);
	}

	// ---------------- 기간
	async function saveRecruitAndClose(id: string | null, recruit: RecruitPeriod, o: SaveOptions) {
		const saved = await saveRecruit(sb, id, recruit, o);
		recruitEdit = undefined;
		await done(`기간을 저장했어요: ${saved}`, o.deploy);
	}
	async function deleteRecruitAndClose(id: string, deploy: boolean) {
		await deleteRecruit(sb, id, deploy);
		recruitEdit = undefined;
		await done(`기간을 지웠어요: ${id}`, deploy);
	}
	// ---------------- 학생
	async function saveStudentAndClose(id: string | null, student: Student, deploy: boolean) {
		const saved = await saveStudent(sb, id, student, deploy);
		studentEdit = undefined;
		await done(`학생을 저장했어요: ${student.name.ko} (${saved})`, deploy);
	}
	async function deleteStudentAndClose(id: string, deploy: boolean) {
		await deleteStudent(sb, id, deploy);
		studentEdit = undefined;
		await done(`학생을 지웠어요: ${id}`, deploy);
	}
	// ---------------- 출처
	async function saveSourceAndClose(id: string | null, source: SourceEntry, deploy: boolean) {
		const saved = await saveSource(sb, id, source, deploy);
		sourceEdit = undefined;
		await done(`출처를 저장했어요: ${saved}번 ${source.title}`, deploy);
	}

	// ---------------- 문서
	async function saveDocAndClose(path: string, doc: JsonObject, expected: string, deploy: boolean) {
		await saveDataset(sb, path, doc, expected, deploy);
		const title = docEdit?.section.title ?? path;
		docEdit = undefined;
		await done(`문서를 저장했어요: ${title} (${path})`, deploy);
	}

	/** 지금 DB 전부로 빌드 검사 (배포 칸의 "빌드 검사") */
	async function checkAll() {
		return runBuildCheck(rowsToFiles(await loadAllRows(sb)));
	}

	async function redeploy() {
		await requestDeploy(sb, '관리자 페이지에서 다시 배포');
		deploys = await loadDeploys(sb);
	}

	onMount(load);
</script>

{#if error}
	<div class="flex flex-col items-start gap-3 md:col-span-2">
		<p role="alert" class="text-sm font-bold text-blocked">읽지 못했어요: {error}</p>
		<AdminButton onclick={load}>다시 읽기</AdminButton>
	</div>
{:else if !overview || !sync || !usage}
	<p class="text-sm text-navy md:col-span-2">불러오는 중…</p>
{:else}
	{#if notice}
		<p role="status" class="text-sm font-bold text-ink md:col-span-2">{notice}</p>
	{/if}
	<!-- 문서를 고칠 때는 표가 넓어 두 칸을 다 쓴다 (변경 기록·배포는 아래로) -->
	<div
		id="admin-sections"
		class="flex min-w-0 scroll-mt-4 flex-col gap-6 {section === 'docs' && docEdit
			? 'md:col-span-2'
			: ''}"
	>
		<SegmentedField label="관리할 것" labelHidden bind:value={section} options={tabs} />

		<!-- 탭을 옮겨도 편집 중인 화면은 남긴다 (숨기기만) -->
		<div hidden={section !== 'recruits'}>
			{#if recruitEdit}
				{#key recruitEdit}
					<RecruitEditor
						{overview}
						original={recruitEdit.original}
						save={saveRecruitAndClose}
						remove={deleteRecruitAndClose}
						cancel={() => (recruitEdit = undefined)}
					/>
				{/key}
			{:else}
				<RecruitList
					{overview}
					sync={sync.recruits}
					onedit={(r) => {
						recruitEdit = { original: r };
						opened();
					}}
				/>
			{/if}
		</div>

		<div hidden={section !== 'students'}>
			{#if studentEdit}
				{#key studentEdit}
					<StudentEditor
						original={studentEdit.original}
						students={overview.studentList}
						usedBy={studentEdit.original ? (usage.students.get(studentEdit.original.id) ?? []) : []}
						save={saveStudentAndClose}
						remove={deleteStudentAndClose}
						cancel={() => (studentEdit = undefined)}
					/>
				{/key}
			{:else}
				<StudentList
					students={overview.studentList}
					{usage}
					sync={sync.students}
					onedit={(s) => {
						studentEdit = { original: s };
						opened();
					}}
				/>
			{/if}
		</div>

		<div hidden={section !== 'sources'}>
			{#if sourceEdit}
				{#key sourceEdit}
					<SourceEditor
						id={sourceEdit.id}
						sources={overview.sourceEntries}
						usedBy={sourceEdit.id ? (usage.sources.get(sourceEdit.id) ?? []) : []}
						save={saveSourceAndClose}
						cancel={() => (sourceEdit = undefined)}
					/>
				{/key}
			{:else}
				<SourceList
					sources={overview.sourceEntries}
					{usage}
					sync={sync.sources}
					onedit={(id) => {
						sourceEdit = { id };
						opened();
					}}
				/>
			{/if}
		</div>

		<div hidden={section !== 'docs'}>
			{#if docsError}
				<div class="flex flex-col items-start gap-3">
					<p role="alert" class="text-sm font-bold text-blocked">
						문서를 읽지 못했어요: {docsError}
					</p>
					<AdminButton onclick={loadDocs}>다시 읽기</AdminButton>
				</div>
			{:else if docs === null}
				<p class="text-sm text-navy">문서를 읽는 중…</p>
			{:else if docEdit}
				{@const version = docs.find((d) => d.path === docEdit?.section.path)}
				{#if version}
					{#key docEdit}
						<DocEditor
							section={docEdit.section}
							{version}
							pending={docPending.has(docEdit.section.id)}
							getRows={() => loadAllRows(sb)}
							save={saveDocAndClose}
							cancel={() => (docEdit = undefined)}
						/>
					{/key}
				{/if}
			{:else}
				<DocList
					pending={docPending}
					onedit={(s) => {
						docEdit = { section: s };
						opened();
					}}
				/>
			{/if}
		</div>
	</div>
	<!-- 넓은 화면의 오른쪽 칸. 판 사이 간격은 탭이 솟는 만큼 24px (Panel) -->
	<div class="flex flex-col gap-6 {section === 'docs' && docEdit ? '' : 'md:pt-[4.25rem]'}">
		<ChangeLogPanel {saves} {me} />
		<DeployPanel {deploys} {me} {redeploy} check={checkAll} />
	</div>
{/if}
