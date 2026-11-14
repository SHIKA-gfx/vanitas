<!--
	기간 고치기·새 기간 (docs/006 6-2의 3, 6-3, ④-2).
	- 저장은 DB 함수 save_recruit 하나 — 기간·예전 id·배너·학생·출처를 한 트랜잭션으로. 일정 확인일·배포 요청도 같은 저장
	- 시작일이나 이름을 바꾸면 id가 바뀐다 → 원래 id는 예전 id로 남아 저장된 목표·공유 링크가 이어진다 (docs/005 10-2)
	- 저장 전 검사(recruit-edit.ts)에 오류가 있으면 저장 단추가 잠긴다. 경고는 알리기만 한다. 최종 검사는 빌드의 validate.py
	- 사이트 부품 그대로 (DateField·SelectField·SegmentedField·NumberField·CheckboxField·Panel), 관리자 화면 것은 TextField·PickList·AdminButton
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import CheckboxField from '$lib/components/CheckboxField.svelte';
	import DateField from '$lib/components/DateField.svelte';
	import NumberField from '$lib/components/NumberField.svelte';
	import Panel from '$lib/components/Panel.svelte';
	import SegmentedField from '$lib/components/SegmentedField.svelte';
	import SelectField from '$lib/components/SelectField.svelte';
	import type { RecruitPeriod } from '$lib/data/types';
	import AdminButton from './AdminButton.svelte';
	import PickList from './PickList.svelte';
	import TextField from './TextField.svelte';
	import type { RecruitOverview, SaveOptions } from './admin-data';
	import {
		SLUG_RE,
		applyRecruit,
		draftFrom,
		draftToRecruit,
		emptyDraft,
		todayKst,
		validateRecruits
	} from './recruit-edit';

	interface Props {
		overview: RecruitOverview;
		/** 고치는 기간. null이면 새 기간 */
		original: RecruitPeriod | null;
		/** 저장. 실패하면 화면 문장을 담은 Error를 던진다 */
		save: (
			originalId: string | null,
			recruit: RecruitPeriod,
			options: SaveOptions
		) => Promise<void>;
		remove: (id: string, deploy: boolean) => Promise<void>;
		cancel: () => void;
	}
	let { overview, original, save, remove, cancel }: Props = $props();

	// 편집기는 기간마다 새로 만든다 (AdminHome의 {#key}) — 처음 값만 읽는다
	const today = todayKst();
	const initial = untrack(() => ({
		id: original?.id ?? null,
		draft: original ? draftFrom(original) : emptyDraft(overview.recruits, today)
	}));
	const originalId = initial.id;
	let draft = $state(initial.draft);
	let verifyToday = $state(true);
	let deploy = $state(true);
	let pending = $state(false);
	let error = $state<string | null>(null);

	const recruit = $derived(draftToRecruit(draft, originalId));
	const issues = $derived(
		validateRecruits(applyRecruit(overview.recruits, originalId, recruit), overview.validation)
	);
	const errors = $derived(issues.filter((i) => i.level === 'error'));
	const warnings = $derived(issues.filter((i) => i.level === 'warning' && i.id === recruit.id));
	const idChanged = $derived(originalId !== null && recruit.id !== originalId);
	const slugError = $derived(
		SLUG_RE.test(draft.slug) ? undefined : '영어 소문자·숫자·하이픈(-)으로 적어요 (예: fes-5-5th)'
	);
	const dateError = $derived(
		draft.end <= draft.start ? '종료일은 시작일보다 늦어야 해요' : undefined
	);

	const studentName = (id: string) => overview.studentName.get(id) ?? id;
	const sourceLabel = (id: string) => overview.sources.find((s) => s.id === id)?.label ?? id;
	const bannerOptions = (type: string) => {
		const list = overview.bannerTypes.map((b) => ({ value: b.id, label: b.label }));
		return list.some((o) => o.value === type) ? list : [{ value: type, label: type }, ...list];
	};
	// 같은 기간에서 이미 고른 학생은 다른 칸의 선택지에서 뺀다
	const bannerStudents = $derived(new Set(draft.banners.flatMap((b) => b.students)));
	const othersOf = (i: number) =>
		new Set([
			...draft.banners.filter((_, j) => j !== i).flatMap((b) => b.students),
			...draft.offPickup
		]);

	function addBanner() {
		draft.banners.push({ type: 'pickup_normal', students: [] });
	}
	function moveBanner(i: number, d: -1 | 1) {
		const next = [...draft.banners];
		[next[i], next[i + d]] = [next[i + d], next[i]];
		draft.banners = next;
	}
	function removeBanner(i: number) {
		draft.banners = draft.banners.filter((_, j) => j !== i);
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (pending || errors.length > 0) return;
		pending = true;
		error = null;
		try {
			await save(originalId, recruit, { verifiedAt: verifyToday ? today : null, deploy });
		} catch (e) {
			error = (e as Error).message;
			pending = false;
		}
	}

	async function onDelete() {
		if (!originalId || pending) return;
		const ok = confirm(
			`${originalId} 기간을 지울까요?\n이 기간을 목표로 고른 사람의 목표는 플래너에서 빠져요. 되돌릴 수 없어요.`
		);
		if (!ok) return;
		pending = true;
		error = null;
		try {
			await remove(originalId, deploy);
		} catch (e) {
			error = (e as Error).message;
			pending = false;
		}
	}

	const SMALL =
		'grid h-9 w-8 shrink-0 place-items-center text-navy hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-strong disabled:opacity-30';
</script>

<Panel title={original ? '기간 고치기' : '새 기간'}>
	<form id="recruit-editor" onsubmit={submit} class="flex flex-col gap-5">
		<div class="grid grid-cols-2 gap-3">
			<DateField label="시작일" bind:value={draft.start} />
			<DateField label="종료일" bind:value={draft.end} error={dateError} />
		</div>

		<div class="flex flex-col gap-2">
			<TextField
				label="이름 (id 뒷부분)"
				bind:value={draft.slug}
				hint="id: {recruit.id}"
				error={slugError}
			/>
			{#if idChanged}
				<p class="rounded-lg bg-slot p-3 text-xs leading-relaxed text-navy">
					id가 <span class="font-mono break-all">{originalId}</span> →
					<span class="font-mono break-all">{recruit.id}</span>로 바뀌어요. 원래 id는 예전 id로 남아
					저장된 목표·공유 링크가 이어져요.
				</p>
			{/if}
		</div>

		<SegmentedField
			label="상태"
			bind:value={draft.status}
			options={[
				{ value: 'estimated', label: '추정' },
				{ value: 'announced', label: '공지' }
			]}
		/>
		<div class="grid gap-5 sm:grid-cols-2">
			<TextField
				label="이벤트"
				bind:value={draft.event}
				hint="함께 열리는 이벤트 이름 (없으면 비움)"
			/>
			<NumberField
				label="무료 모집"
				bind:value={draft.freePulls}
				unit="회"
				max={1000}
				hint="없으면 0"
			/>
		</div>

		<div class="flex flex-col gap-3">
			{#each draft.banners as banner, i (i)}
				<div
					role="group"
					aria-label="배너 {i + 1}"
					class="flex flex-col gap-3 rounded-lg bg-wash p-3"
				>
					<div class="flex items-center">
						<span class="flex-1 text-sm font-bold text-navy">배너 {i + 1}</span>
						<button
							type="button"
							class={SMALL}
							aria-label="배너 {i + 1} 위로"
							disabled={i === 0}
							onclick={() => moveBanner(i, -1)}>▲</button
						>
						<button
							type="button"
							class={SMALL}
							aria-label="배너 {i + 1} 아래로"
							disabled={i === draft.banners.length - 1}
							onclick={() => moveBanner(i, 1)}>▼</button
						>
						<button
							type="button"
							class="{SMALL} text-sm"
							aria-label="배너 {i + 1} 빼기"
							disabled={draft.banners.length === 1}
							onclick={() => removeBanner(i)}>✕</button
						>
					</div>
					<SelectField label="종류" bind:value={banner.type} options={bannerOptions(banner.type)} />
					<PickList
						label="픽업 학생"
						bind:items={banner.students}
						options={overview.students}
						exclude={othersOf(i)}
						labelOf={studentName}
						addLabel="학생 더하기"
						invalid={banner.students.length === 0}
					/>
				</div>
			{/each}
			<div>
				<AdminButton onclick={addBanner}>배너 더하기</AdminButton>
			</div>
		</div>

		<PickList
			label="픽업 외 모집 가능 학생"
			bind:items={draft.offPickup}
			options={overview.students}
			exclude={bannerStudents}
			labelOf={studentName}
			addLabel="학생 더하기"
			hint="모집할 수 있지만 목표로는 고를 수 없는 학생 (페스의 복각 학생 등)"
		/>
		<PickList
			label="출처"
			bind:items={draft.sources}
			options={overview.sources}
			labelOf={sourceLabel}
			addLabel="출처 더하기"
			invalid={draft.sources.length === 0}
			hint="공지된 기간에는 공식 출처가 하나 있어야 해요. 목록에 없는 새 출처는 지금은 SQL Editor로 더해요"
		/>
		<PickList
			label="예전 id"
			bind:items={draft.previousIds}
			labelOf={(id) => id}
			hint="날짜가 바뀌기 전의 id. 저장된 목표·공유 링크를 이 기간으로 이어 줘요 — 빼면 그 링크가 끊겨요"
		/>
		<TextField label="메모" bind:value={draft.note} multiline />

		<div class="flex flex-col">
			<CheckboxField label="일정 확인일을 오늘({today})로" bind:checked={verifyToday} />
			<CheckboxField label="저장하면 배포 요청" bind:checked={deploy} />
		</div>

		{#if errors.length > 0}
			<div
				role="alert"
				class="rounded-lg bg-surface p-3 shadow-[inset_0_0_0_1px_rgb(137_25_40/0.4)]"
			>
				<p class="text-sm font-bold text-blocked">고쳐야 저장할 수 있어요</p>
				<ul class="mt-1 list-disc pl-5 text-sm text-ink">
					{#each errors as issue, i (i)}
						<li>{issue.id === recruit.id ? '' : `${issue.id}: `}{issue.message}</li>
					{/each}
				</ul>
			</div>
		{/if}
		{#if warnings.length > 0}
			<ul class="text-xs text-navy">
				{#each warnings as issue, i (i)}
					<li>확인: {issue.message}</li>
				{/each}
			</ul>
		{/if}
		{#if error}
			<p role="alert" class="text-sm font-bold text-blocked">저장하지 못했어요: {error}</p>
		{/if}

		<div class="flex flex-wrap items-center gap-y-3">
			<AdminButton variant="primary" type="submit" disabled={pending || errors.length > 0}>
				{pending ? '저장하는 중…' : '저장'}
			</AdminButton>
			<AdminButton onclick={cancel} disabled={pending}>취소</AdminButton>
			{#if original}
				<button
					type="button"
					class="ml-auto min-h-11 px-3 text-sm font-bold text-blocked underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-brand-strong disabled:opacity-50"
					disabled={pending}
					onclick={onDelete}>기간 지우기</button
				>
			{/if}
		</div>
	</form>
</Panel>
