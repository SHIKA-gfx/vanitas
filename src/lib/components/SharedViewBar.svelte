<!--
	공유 링크로 연 값을 보는 동안 화면 아래에 떠 있는 띠 (기획 B안, 2026-10-02).
	내 저장값은 그대로 남아 있고, "내 값으로 돌아가기"로 되돌릴 수 있다.
	값을 하나라도 고치면 띠가 사라지고 그 값이 내 저장값이 된다.
-->
<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { getSavedStore } from '$lib/state/saved.svelte';
	import Toast from './Toast.svelte';

	const store = getSavedStore();
</script>

{#if store.sharedView}
	<Toast>
		{m.share_viewing()}
		{#snippet actions()}
			<button
				type="button"
				onclick={() => store.backToMine()}
				class="font-bold text-sky underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-white"
			>
				{m.share_back()}
			</button>
		{/snippet}
	</Toast>
{/if}
