<!--
	문서 편집의 칸 하나 (doc-edit.ts). 값의 모양에 따라 고르는 편집기:
	원시값 → PrimitiveInput, 원시값 목록 → PrimitiveList, 같은 모양 줄 목록 → TableEditor, 그 밖의 목록 → CardList,
	묶음 → 접히는 ObjectFields (처음 두 단계는 펼쳐 둔다), 자리 표시 → 그 탭에서 고친다는 안내.
	빈 목록에 줄 틀(ROW_TEMPLATES)이 있으면 "첫 줄 만들기" — 줄 더하기는 마지막 줄 복사라 빈 목록에는 더할 수 없다 (스토리 길잡이, 2026-11-16).
	CARD_KEYS는 표로 보일 수 있어도 카드로 (긴 설명이 든 사전 블록)
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import CardList from './CardList.svelte';
	import KeyLabel from './KeyLabel.svelte';
	import ObjectFields from './ObjectFields.svelte';
	import PrimitiveInput from './PrimitiveInput.svelte';
	import PrimitiveList from './PrimitiveList.svelte';
	import TableEditor from './TableEditor.svelte';
	import {
		copyOf,
		isObject,
		isPlaceholder,
		isPrimitive,
		tableColumns,
		type Json,
		type JsonObject
	} from './doc-edit';
	import { getDocPath } from './doc-context';
	import { CARD_KEYS, KEY_LABELS, ROW_TEMPLATES } from './doc-sections';

	let {
		parent,
		key,
		depth = 0,
		labelText
	}: {
		parent: JsonObject;
		key: string;
		depth?: number;
		/** KEY_LABELS 대신 쓸 이름 (doc-sections.ts TOP_LABELS) */
		labelText?: string;
	} = $props();
	const value = $derived(parent[key]);
	const label = $derived(labelText ?? KEY_LABELS[key] ?? key);
	const columns = $derived(
		Array.isArray(value) && !CARD_KEYS.has(key) ? tableColumns(value) : null
	);
	const template = $derived(ROW_TEMPLATES[`${getDocPath() ?? ''}:${key}`]);
	// 처음 한 단계(문서의 맨 위 칸)는 펼쳐 둔다. 카드로 고치는 목록(사전 설명 블록)도 — 항목을 펼치면 바로 쓴다
	let open = $state(untrack(() => depth < 1 || CARD_KEYS.has(key)));
</script>

{#if isPrimitive(value)}
	<div>
		<p class="mb-1 text-xs font-medium text-navy"><KeyLabel name={key} label={labelText} /></p>
		<PrimitiveInput {parent} {key} {label} />
	</div>
{:else if isPlaceholder(value)}
	<p class="text-xs text-navy">
		<KeyLabel name={key} label={labelText} /> — 따로 둔 표예요. 위쪽 탭에서 고쳐요
	</p>
{:else}
	<div class="rounded-lg shadow-[inset_0_0_0_1px_rgb(42_66_91/0.1)]">
		<button
			type="button"
			class="flex min-h-10 w-full items-center gap-2 px-3 text-left text-sm font-bold text-navy focus-visible:outline-2 focus-visible:outline-brand-strong"
			aria-expanded={open}
			onclick={() => (open = !open)}
		>
			<span aria-hidden="true" class="text-xs">{open ? '▾' : '▸'}</span>
			<KeyLabel name={key} label={labelText} />
			{#if Array.isArray(value)}
				<span class="text-xs font-normal">· {value.length}줄</span>
			{/if}
		</button>
		{#if open}
			<div class="px-3 pb-3">
				{#if Array.isArray(value)}
					{#if value.length === 0 && template}
						<button
							type="button"
							class="px-1 text-xs font-bold text-brand-strong hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-strong"
							onclick={() => (value as Json[]).push(copyOf(template))}>＋ 첫 줄 만들기</button
						>
					{:else if value.length === 0 || value.every(isPrimitive)}
						<PrimitiveList list={value as Json[]} {label} />
					{:else if columns}
						<TableEditor rows={value as Json[]} {columns} {label} />
					{:else}
						<CardList items={value as Json[]} {label} {depth} {template} />
					{/if}
				{:else if isObject(value)}
					<ObjectFields obj={value} {depth} />
				{/if}
			</div>
		{/if}
	</div>
{/if}
