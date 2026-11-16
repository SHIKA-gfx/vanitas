<!--
	새 판 감지 (2026-11-16, docs/008 3장). 이 탭을 연 뒤 사이트가 다시 배포됐으면(기능 추가·관리자 데이터 저장)
	새로 고침을 권한다. 옛 탭이 새 칸을 모른 채 저장해 계정까지 올리는 일을 줄이려는 것 (docs/007 10-4).

	- 알아채기: SvelteKit `version.pollInterval`(vite.config.ts)이 몇 분마다 `_app/version.json`을 보고,
	  탭으로 돌아올 때도 한 번 본다. 개발 서버에서는 늘 "바뀌지 않음"
	- 알아챈 뒤 다른 화면으로 옮기면 그 이동을 새로 고침으로 한다 (입력은 브라우저에 저장돼 있어 잃지 않는다)
	- 같은 화면에 머물면 띠로 권한다. "나중에"를 누르면 이 탭에서는 다시 띄우지 않는다
	- 공유 링크를 보는 동안·관리자 페이지에서는 띄우지도, 새로 고치지도 않는다
	  (공유 보기가 풀리거나, 고치던 데이터 문서를 잃지 않게. 관리자 페이지는 저장할 때마다 배포가 일어난다)
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { page, updated } from '$app/state';
	import { beforeNavigate } from '$app/navigation';
	import { m } from '$lib/paraglide/messages.js';
	import { getSavedStore } from '$lib/state/saved.svelte';
	import Toast from './Toast.svelte';

	const store = getSavedStore();
	let dismissed = $state(false);
	const quiet = $derived(store.sharedView || page.route.id?.startsWith('/admin') === true);

	onMount(() => {
		const onVisible = () => {
			if (document.visibilityState === 'visible' && !updated.current) void updated.check();
		};
		document.addEventListener('visibilitychange', onVisible);
		return () => document.removeEventListener('visibilitychange', onVisible);
	});

	beforeNavigate(({ willUnload, to, cancel }) => {
		if (!updated.current || willUnload || !to?.url || quiet) return;
		cancel();
		location.href = to.url.href;
	});
</script>

{#if updated.current && !dismissed && !quiet}
	<Toast>
		{m.update_ready()}
		{#snippet actions()}
			<button
				type="button"
				onclick={() => (dismissed = true)}
				class="text-white/80 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-white"
			>
				{m.update_later()}
			</button>
			<button
				type="button"
				onclick={() => location.reload()}
				class="font-bold text-sky underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-white"
			>
				{m.update_reload()}
			</button>
		{/snippet}
	</Toast>
{/if}
