<!--
	글자 입력칸 (관리자 화면). 계산기의 NumberField와 같은 모양 — 판에 파인 홈 48px(layout.css의 field),
	라벨 앞 60° 막대, 오류면 blocked (디자인 문서 5-19). 계산기에는 글자 입력이 없어 관리자 화면에만 둔다
-->
<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	interface Props {
		label: string;
		value: string;
		type?: 'text' | 'email' | 'password';
		autocomplete?: HTMLInputAttributes['autocomplete'];
		/** 칸 아래 작은 안내 */
		hint?: string;
		/** 입력 오류 안내 */
		error?: string;
		/** 여러 줄 (메모) */
		multiline?: boolean;
	}
	let {
		label,
		value = $bindable(''),
		type = 'text',
		autocomplete,
		hint,
		error,
		multiline = false
	}: Props = $props();
	const id = $props.id();
	const describedBy = $derived(
		[error ? `${id}-error` : '', hint ? `${id}-hint` : ''].filter(Boolean).join(' ') || undefined
	);
</script>

<div>
	<div class="mb-2 flex min-h-6 items-center">
		<label for={id} class="flex items-center gap-2 text-[0.8125rem] font-medium text-navy">
			<span
				aria-hidden="true"
				class="h-3 w-[3px] shrink-0 -skew-x-30 rounded-[1px_1.5px] {error
					? 'bg-blocked'
					: 'bg-brand'}"
			></span>
			{label}
		</label>
	</div>
	{#if multiline}
		<textarea
			{id}
			bind:value
			rows="3"
			aria-describedby={describedBy}
			aria-invalid={error ? true : undefined}
			class="field h-auto min-h-24 py-3 leading-relaxed {error ? 'field-error' : ''}"></textarea>
	{:else}
		<input
			{id}
			{type}
			{autocomplete}
			bind:value
			spellcheck="false"
			aria-describedby={describedBy}
			aria-invalid={error ? true : undefined}
			class="field {error ? 'field-error' : ''}"
		/>
	{/if}
	{#if error}
		<p id="{id}-error" class="mt-2 text-xs font-bold text-blocked">{error}</p>
	{/if}
	{#if hint}
		<p id="{id}-hint" class="mt-2 text-xs text-navy">{hint}</p>
	{/if}
</div>
