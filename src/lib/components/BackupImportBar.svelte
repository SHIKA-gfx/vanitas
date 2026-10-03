<!--
	백업 링크로 열었을 때 "이 기기로 불러올까요?"를 묻는 띠 (2026-10-02).
	확인 없이 바로 바꾸지 않는다 — 이 기기에 저장된 입력이 통째로 바뀌기 때문.
	불러오든 취소하든 주소의 백업 값은 지운다 (새로고침해도 다시 묻지 않게).
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { m } from '$lib/paraglide/messages.js';
	import { clearQuery, getSavedStore } from '$lib/state/saved.svelte';
	import { BACKUP_PARAM, decodeBackup } from '$lib/state/backup';
	import type { SaveFile } from '$lib/state/persist';
	import Toast from './Toast.svelte';

	const store = getSavedStore();
	let pending = $state<SaveFile | null>(null);
	let notice = $state<string | null>(null);
	let timer: ReturnType<typeof setTimeout> | undefined;

	function show(message: string) {
		notice = message;
		clearTimeout(timer);
		timer = setTimeout(() => (notice = null), 4000);
	}

	onMount(() => {
		const code = page.url.searchParams.get(BACKUP_PARAM);
		if (code === null) return;
		decodeBackup(code).then((file) => {
			if (file) pending = file;
			else {
				clearQuery();
				show(m.backup_invalid());
			}
		});
		return () => clearTimeout(timer);
	});

	function accept() {
		if (pending) store.importFile(pending);
		pending = null;
		clearQuery();
		show(m.backup_imported());
	}

	function cancel() {
		pending = null;
		clearQuery();
	}
</script>

{#if pending}
	<Toast>
		{m.backup_import_ask()}
		{#snippet actions()}
			<button
				type="button"
				onclick={cancel}
				class="text-white/80 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-white"
			>
				{m.backup_cancel()}
			</button>
			<button
				type="button"
				onclick={accept}
				class="font-bold text-sky underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-white"
			>
				{m.backup_import()}
			</button>
		{/snippet}
	</Toast>
{:else if notice}
	<Toast>{notice}</Toast>
{/if}
