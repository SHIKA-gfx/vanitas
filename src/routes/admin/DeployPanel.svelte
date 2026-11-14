<!--
	배포 (docs/006 6-4, 6-2의 6). 배포 요청 한 행 = Cloudflare 빌드 한 번 (Database Webhook).
	"다시 배포"는 SQL 편집기로 고친 뒤나 웹훅 확인용. 빌드 결과는 Cloudflare 배포 목록에서 본다
-->
<script lang="ts">
	import Panel from '$lib/components/Panel.svelte';
	import AdminButton from './AdminButton.svelte';
	import type { DeployRequest } from './admin-data';
	import type { CheckResult } from './build-check';
	import { actorLabel, formatKst } from './admin-data';

	interface Props {
		deploys: DeployRequest[];
		me: string;
		/** 배포 요청을 넣고 목록을 다시 읽는다. 실패하면 문장을 던진다 */
		redeploy: () => Promise<void>;
		/** 지금 DB 전부로 빌드 검사 (validate.py) */
		check: () => Promise<CheckResult>;
	}
	let { deploys, me, redeploy, check }: Props = $props();

	let checking = $state(false);
	let result = $state<CheckResult | { failed: string } | null>(null);

	async function onCheck() {
		if (checking) return;
		checking = true;
		result = null;
		try {
			result = await check();
		} catch (e) {
			result = { failed: (e as Error).message };
		}
		checking = false;
	}

	let pending = $state(false);
	let message = $state<{ ok: boolean; text: string } | null>(null);

	async function onclick() {
		if (pending) return;
		if (!confirm('사이트를 지금 DB 내용으로 다시 빌드할까요? (1~2분)')) return;
		pending = true;
		message = null;
		try {
			await redeploy();
			message = { ok: true, text: '배포를 요청했어요. 1~2분 뒤 사이트에 반영돼요.' };
		} catch (e) {
			message = { ok: false, text: `요청하지 못했어요: ${(e as Error).message}` };
		}
		pending = false;
	}
</script>

<Panel title="배포">
	<div class="flex flex-col gap-4">
		{#if deploys.length === 0}
			<p class="text-sm text-navy">아직 배포 요청이 없어요.</p>
		{:else}
			<ul class="flex flex-col gap-1.5">
				{#each deploys as d (d.id)}
					<li class="flex flex-wrap items-baseline gap-x-2 text-sm">
						<span class="font-num text-ink tabular-nums">{formatKst(d.at)}</span>
						<span class="font-medium text-navy">{actorLabel(d.actor, me)}</span>
						<span class="min-w-0 text-xs break-all text-navy">{d.reason}</span>
					</li>
				{/each}
			</ul>
		{/if}
		<div class="flex flex-wrap items-center gap-x-2 gap-y-3">
			<AdminButton {onclick} disabled={pending}>
				{pending ? '요청하는 중…' : '다시 배포'}
			</AdminButton>
			<AdminButton onclick={onCheck} disabled={checking}>
				{checking ? '검사하는 중…' : '빌드 검사'}
			</AdminButton>
		</div>
		<p class="text-xs text-navy">
			빌드 결과는 Cloudflare 배포 목록에서. "빌드 검사"는 지금 DB로 빌드하면 검사(validate.py)를
			통과하는지 이 브라우저에서 미리 봐요 (처음에는 10초쯤)
		</p>
		{#if result}
			{#if 'failed' in result}
				<p role="alert" class="text-sm font-bold text-blocked">{result.failed}</p>
			{:else}
				<div role="status" class="text-sm">
					<p class="font-bold {result.errors.length > 0 ? 'text-blocked' : 'text-ink'}">
						빌드 검사: 오류 {result.errors.length}건 · 경고 {result.warnings.length}건
						{result.errors.length > 0 ? '— 이대로는 DB 빌드가 멈춰요' : ''}
					</p>
					<ul class="mt-1 list-disc pl-5 text-xs text-ink">
						{#each result.errors as m, i (i)}<li class="text-blocked">오류: {m}</li>{/each}
						{#each result.warnings as m, i (i)}<li>경고: {m}</li>{/each}
					</ul>
				</div>
			{/if}
		{/if}
		{#if message}
			<p role="status" class="text-sm font-bold {message.ok ? 'text-ink' : 'text-blocked'}">
				{message.text}
			</p>
		{/if}
	</div>
</Panel>
