<!--
	배포 (docs/006 6-4, 6-2의 6). 배포 요청 한 행 = Cloudflare 빌드 한 번 (Database Webhook).
	"다시 배포"는 SQL 편집기로 고친 뒤나 웹훅 확인용. 빌드 결과는 Cloudflare 배포 목록에서 본다
-->
<script lang="ts">
	import Panel from '$lib/components/Panel.svelte';
	import AdminButton from './AdminButton.svelte';
	import type { DeployRequest } from './admin-data';
	import { actorLabel, formatKst } from './admin-data';

	interface Props {
		deploys: DeployRequest[];
		me: string;
		/** 배포 요청을 넣고 목록을 다시 읽는다. 실패하면 문장을 던진다 */
		redeploy: () => Promise<void>;
	}
	let { deploys, me, redeploy }: Props = $props();

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
			<span class="text-xs text-navy">빌드 결과는 Cloudflare 배포 목록에서</span>
		</div>
		{#if message}
			<p role="status" class="text-sm font-bold {message.ok ? 'text-ink' : 'text-blocked'}">
				{message.text}
			</p>
		{/if}
	</div>
</Panel>
