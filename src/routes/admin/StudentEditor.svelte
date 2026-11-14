<!--
	학생 더하기·고치기 (docs/006 6-3, ④-3). 저장은 DB 함수 save_student 하나 (배포 요청도 같은 저장).
	- id는 만들 때만 정한다 — 저장값·공유 링크(목표 이름 "기간 id~학생 id")가 쓴다
	- 이름 괄호 규칙은 validate.py와 같다: 한국어 반각 "이름(의상)", 일본어 전각 "名前（衣装）"
	- 기간에서 쓰이는 학생은 지울 수 없다 (DB 참조 제약도 막는다)
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import CheckboxField from '$lib/components/CheckboxField.svelte';
	import Panel from '$lib/components/Panel.svelte';
	import SegmentedField from '$lib/components/SegmentedField.svelte';
	import type { Student } from '$lib/data/types';
	import AdminButton from './AdminButton.svelte';
	import TextField from './TextField.svelte';
	import {
		draftToStudent,
		emptyStudentDraft,
		studentDraftFrom,
		validateStudent
	} from './catalog-edit';

	interface Props {
		/** 고치는 학생. null이면 새 학생 */
		original: Student | null;
		students: Student[];
		/** 이 학생을 쓰는 기간 id */
		usedBy: string[];
		save: (originalId: string | null, student: Student, deploy: boolean) => Promise<void>;
		remove: (id: string, deploy: boolean) => Promise<void>;
		cancel: () => void;
	}
	let { original, students, usedBy, save, remove, cancel }: Props = $props();

	// 편집기는 학생마다 새로 만든다 (AdminHome의 {#key}) — 처음 값만 읽는다
	const initial = untrack(() => ({
		id: original?.id ?? null,
		draft: original ? studentDraftFrom(original) : emptyStudentDraft()
	}));
	const originalId = initial.id;
	let draft = $state(initial.draft);
	// 게임 번호는 글자로 받는다 (쉼표 없이). 숫자가 아니면 0 → 검사에 걸린다
	let gameIdText = $state(initial.draft.gameId ? String(initial.draft.gameId) : '');
	const current = $derived({
		...draft,
		gameId: /^\d{1,9}$/.test(gameIdText.trim()) ? Number(gameIdText.trim()) : 0
	});
	let deploy = $state(true);
	let pending = $state(false);
	let error = $state<string | null>(null);

	const issues = $derived(
		validateStudent(
			current,
			students.filter((s) => s.id !== originalId),
			originalId === null
		)
	);
	const errors = $derived(issues.filter((i) => i.level === 'error'));
	const fieldError = (field: string) =>
		issues.find((i) => i.level === 'error' && i.field === field)?.message;
	const fieldWarning = (field: string) =>
		issues.find((i) => i.level === 'warning' && i.field === field)?.message;

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (pending || errors.length > 0) return;
		pending = true;
		error = null;
		try {
			await save(originalId, draftToStudent(current), deploy);
		} catch (e) {
			error = (e as Error).message;
			pending = false;
		}
	}

	async function onDelete() {
		if (!originalId || pending || usedBy.length > 0) return;
		if (!confirm(`${draft.ko}(${originalId}) 학생을 지울까요? 되돌릴 수 없어요.`)) return;
		pending = true;
		error = null;
		try {
			await remove(originalId, deploy);
		} catch (e) {
			error = (e as Error).message;
			pending = false;
		}
	}
</script>

<Panel title={original ? '학생 고치기' : '새 학생'}>
	<form onsubmit={submit} class="flex flex-col gap-5">
		{#if originalId}
			<div>
				<p class="text-[0.8125rem] font-medium text-navy">id</p>
				<p class="mt-1 font-mono text-sm text-ink">{originalId}</p>
				<p class="mt-1 text-xs text-navy">저장된 목표·공유 링크가 쓰는 이름이라 바꾸지 않아요</p>
			</div>
		{:else}
			<TextField
				label="id"
				bind:value={draft.id}
				hint="영어 소문자·숫자·밑줄. 저장한 뒤에는 바꿀 수 없어요 (예: hoshino_armed)"
				error={draft.id ? fieldError('id') : undefined}
			/>
		{/if}
		<TextField
			label="게임 번호"
			bind:value={gameIdText}
			inputmode="numeric"
			hint="게임 안 학생 번호 (학생마다 다르다)"
			error={gameIdText.trim() ? fieldError('gameId') : undefined}
		/>
		<TextField
			label="한국어 이름"
			bind:value={draft.ko}
			hint="괄호는 반각, 앞 공백 없이: 호시노(무장)"
			error={draft.ko ? fieldError('ko') : undefined}
		/>
		<TextField
			label="일본어 이름"
			bind:value={draft.ja}
			hint={fieldWarning('ja') ?? '전각 괄호, 앞 공백 없이: ホシノ（臨戦）'}
			error={fieldError('ja')}
		/>
		<SegmentedField
			label="이름 상태"
			bind:value={draft.status}
			options={[
				{ value: 'official', label: '공식 이름' },
				{ value: 'provisional', label: '가칭' }
			]}
		/>
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
			{#if originalId}
				<button
					type="button"
					class="ml-auto min-h-11 px-3 text-sm font-bold text-blocked underline-offset-4 focus-visible:outline-2 focus-visible:outline-brand-strong enabled:hover:underline disabled:text-navy disabled:opacity-60"
					disabled={pending || usedBy.length > 0}
					title={usedBy.length > 0 ? `쓰는 기간: ${usedBy.join(', ')}` : undefined}
					onclick={onDelete}
					>{usedBy.length > 0
						? `기간 ${usedBy.length}개에서 쓰여 지울 수 없음`
						: '학생 지우기'}</button
				>
			{/if}
		</div>
	</form>
</Panel>
