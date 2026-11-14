<!--
	문서 편집의 원시값 칸 하나 (doc-edit.ts readPrimitive). 처음 값의 형을 지킨다:
	숫자 → 숫자 칸(숫자가 아니면 빨간 테두리, 데이터는 그대로), 참/거짓 → 체크, 정해진 값(ENUMS) → 고르기,
	긴 글자 → 여러 줄, 빈칸(null) → 비우면 null. compact는 표 안의 칸
-->
<script lang="ts">
	import { ENUMS, enumShort } from './doc-sections';
	import { getInvalidSet } from './doc-context';
	import { readPrimitive, type Json } from './doc-edit';

	interface Props {
		parent: Record<string, Json> | Json[];
		key: string | number;
		/** 화면 낭독기용 이름 */
		label: string;
		/** 빈칸(null)에 숫자를 적으면 숫자로 (표의 숫자 열) */
		numericHint?: boolean;
		compact?: boolean;
	}
	let { parent, key, label, numericHint = false, compact = false }: Props = $props();

	const container = $derived(parent as Record<string | number, Json>);
	const invalidSet = getInvalidSet();
	const uid = $props.id();
	const value = $derived(container[key]);
	const original = $derived(value as null | number | string | boolean);
	const enumKey = $derived(typeof key === 'string' ? key : '');
	const options = $derived(
		typeof value === 'string' && ENUMS[enumKey]?.some((o) => o.value === value)
			? ENUMS[enumKey]
			: null
	);
	const long = $derived(typeof value === 'string' && (value.length > 48 || value.includes('\n')));
	let invalid = $state(false);

	function setInvalid(on: boolean) {
		invalid = on;
		if (on) invalidSet?.add(uid);
		else invalidSet?.delete(uid);
	}
	$effect(() => () => invalidSet?.delete(uid));

	function onInput(event: Event & { currentTarget: HTMLInputElement | HTMLTextAreaElement }) {
		const next = readPrimitive(
			event.currentTarget.value,
			original as null | number | string,
			numericHint
		);
		if (next === undefined) return setInvalid(true);
		setInvalid(false);
		container[key] = next;
	}

	const BOX = $derived(
		compact
			? 'h-9 w-full rounded-md border bg-slot px-2 text-sm text-ink'
			: 'h-10 w-full rounded-lg border bg-slot px-3 text-sm text-ink'
	);
	const BORDER = $derived(
		invalid
			? 'border-blocked'
			: 'border-navy/12 hover:border-navy/30 focus:border-brand-strong focus:bg-surface'
	);
</script>

{#if typeof value === 'boolean'}
	<label class="inline-flex min-h-9 cursor-pointer items-center gap-2 text-sm text-ink">
		<input
			type="checkbox"
			class="size-4 accent-brand-strong"
			checked={value}
			onchange={(e) => (container[key] = e.currentTarget.checked)}
			aria-label={label}
		/>
		{value ? '예' : '아니오'}
	</label>
{:else if options}
	<select
		class="{BOX} {BORDER} appearance-auto"
		aria-label={label}
		title={value as string}
		value={value as string}
		onchange={(e) => (container[key] = e.currentTarget.value)}
	>
		{#each options as o (o.value)}
			<option value={o.value}>{compact ? enumShort(o.label) : o.label}</option>
		{/each}
	</select>
{:else if long && !compact}
	<textarea
		class="{BOX} {BORDER} h-auto min-h-20 py-2 leading-relaxed"
		rows="3"
		aria-label={label}
		value={value as string}
		oninput={onInput}></textarea>
{:else}
	<input
		type="text"
		inputmode={typeof value === 'number' ? 'decimal' : undefined}
		class="{BOX} {BORDER} {typeof value === 'number' ? 'text-right font-num' : ''}"
		aria-label={label}
		aria-invalid={invalid ? true : undefined}
		placeholder={value === null ? '비어 있음' : undefined}
		value={value === null ? '' : String(value)}
		oninput={onInput}
		title={typeof value === 'string' && compact ? value : undefined}
	/>
{/if}
