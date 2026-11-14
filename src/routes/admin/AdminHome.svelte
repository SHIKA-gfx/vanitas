<!--
	관리자 첫 화면 (docs/006 6-2). 미래시 목록·편집 · 변경 기록 · 배포.
	넓은 화면은 두 칸: 왼쪽 미래시(목록 또는 편집), 오른쪽 변경 기록·배포
-->
<script lang="ts">
	import type { SupabaseClient } from '@supabase/supabase-js';
	import { onMount, tick } from 'svelte';
	import type { RecruitPeriod } from '$lib/data/types';
	// 이 화면을 연 배포(=지금 사이트)에 들어 있는 미래시 — DB와 비교해 "반영 전"을 알린다
	import siteSchedule from '../../../data/ko/schedule.json';
	import AdminButton from './AdminButton.svelte';
	import ChangeLogPanel from './ChangeLogPanel.svelte';
	import DeployPanel from './DeployPanel.svelte';
	import RecruitEditor from './RecruitEditor.svelte';
	import RecruitList from './RecruitList.svelte';
	import type { DeployRequest, RecruitOverview, SaveLog, SaveOptions } from './admin-data';
	import {
		deleteRecruit,
		loadChangeLog,
		loadDeploys,
		loadRecruits,
		requestDeploy,
		saveRecruit
	} from './admin-data';
	import { compareWithSite } from './recruit-edit';

	let { sb, me }: { sb: SupabaseClient; me: string } = $props();

	const siteRecruits = siteSchedule.recruits as unknown as RecruitPeriod[];

	let overview = $state<RecruitOverview | null>(null);
	let saves = $state<SaveLog[]>([]);
	let deploys = $state<DeployRequest[]>([]);
	let error = $state<string | null>(null);
	/** 편집 중인 기간. null이면 새 기간, undefined면 목록 */
	let editing = $state<{ original: RecruitPeriod | null } | undefined>(undefined);
	let notice = $state<string | null>(null);

	const sync = $derived(overview ? compareWithSite(overview.recruits, siteRecruits) : null);

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

	async function edit(original: RecruitPeriod | null) {
		notice = null;
		editing = { original };
		await tick();
		document
			.getElementById('recruit-editor')
			?.closest('section, div')
			?.scrollIntoView({ block: 'start' });
	}

	async function save(originalId: string | null, recruit: RecruitPeriod, options: SaveOptions) {
		const id = await saveRecruit(sb, originalId, recruit, options);
		editing = undefined;
		notice = `저장했어요: ${id}${options.deploy ? ' · 배포를 요청했어요 (1~2분)' : ''}`;
		await load();
	}

	async function remove(id: string, deploy: boolean) {
		await deleteRecruit(sb, id, deploy);
		editing = undefined;
		notice = `지웠어요: ${id}${deploy ? ' · 배포를 요청했어요 (1~2분)' : ''}`;
		await load();
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
{:else if !overview || !sync}
	<p class="text-sm text-navy md:col-span-2">불러오는 중…</p>
{:else}
	{#if notice}
		<p role="status" class="text-sm font-bold text-ink md:col-span-2">{notice}</p>
	{/if}
	{#if editing}
		{#key editing}
			<RecruitEditor
				{overview}
				original={editing.original}
				{save}
				{remove}
				cancel={() => (editing = undefined)}
			/>
		{/key}
	{:else}
		<RecruitList {overview} {sync} onedit={edit} />
	{/if}
	<!-- 넓은 화면의 오른쪽 칸. 판 사이 간격은 탭이 솟는 만큼 24px (Panel) -->
	<div class="flex flex-col gap-6">
		<ChangeLogPanel {saves} {me} />
		<DeployPanel {deploys} {me} {redeploy} />
	</div>
{/if}
