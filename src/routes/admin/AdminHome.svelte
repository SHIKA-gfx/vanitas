<!--
	관리자 첫 화면 (docs/006 6-2). 미래시 목록 · 변경 기록 · 배포.
	넓은 화면은 두 칸: 왼쪽 미래시, 오른쪽 변경 기록·배포
-->
<script lang="ts">
	import type { SupabaseClient } from '@supabase/supabase-js';
	import { onMount } from 'svelte';
	import AdminButton from './AdminButton.svelte';
	import ChangeLogPanel from './ChangeLogPanel.svelte';
	import DeployPanel from './DeployPanel.svelte';
	import RecruitList from './RecruitList.svelte';
	import type { DeployRequest, RecruitOverview, SaveLog } from './admin-data';
	import { loadChangeLog, loadDeploys, loadRecruits, requestDeploy } from './admin-data';

	let { sb, me }: { sb: SupabaseClient; me: string } = $props();

	let overview = $state<RecruitOverview | null>(null);
	let saves = $state<SaveLog[]>([]);
	let deploys = $state<DeployRequest[]>([]);
	let error = $state<string | null>(null);

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
{:else if !overview}
	<p class="text-sm text-navy md:col-span-2">불러오는 중…</p>
{:else}
	<RecruitList {overview} />
	<!-- 넓은 화면의 오른쪽 칸. 판 사이 간격은 탭이 솟는 만큼 24px (Panel) -->
	<div class="flex flex-col gap-6">
		<ChangeLogPanel {saves} {me} />
		<DeployPanel {deploys} {me} {redeploy} />
	</div>
{/if}
