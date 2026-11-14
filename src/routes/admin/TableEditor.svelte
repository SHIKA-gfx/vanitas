<!--
	표로 고치는 목록 (레이드 일정·레벨 표 같은, 칸이 모두 원시값인 줄들 — doc-edit.ts tableColumns).
	줄 순서 ▲▼, 빼기 ✕, 더하기는 마지막 줄 복사. 원시값 목록 칸(출처 번호 등)은 쉼표로 적는다.
	좁은 화면은 표가 옆으로 밀린다 (첫 열은 남는다)
-->
<script lang="ts">
	import KeyLabel from './KeyLabel.svelte';
	import PrimitiveInput from './PrimitiveInput.svelte';
	import { getInvalidSet } from './doc-context';
	import {
		columnIsNumeric,
		copyOf,
		isObject,
		listToText,
		textToList,
		type Json,
		type JsonObject
	} from './doc-edit';
	import { ENUMS, KEY_LABELS, enumShort } from './doc-sections';

	let { rows, columns, label }: { rows: Json[]; columns: string[]; label: string } = $props();

	const invalidSet = getInvalidSet();
	const numeric = $derived(new Set(columns.filter((c) => columnIsNumeric(rows, c))));
	/** 칸 글자(text-sm)의 폭, rem — 영숫자 0.55, 한글 0.95 */
	const textRem = (text: string) =>
		[...text].reduce((n, ch) => n + (ch.charCodeAt(0) > 0x2e80 ? 0.95 : 0.55), 0);
	/** 열 폭(rem): 그 열의 가장 긴 값 + 안쪽 여백 (고르기 칸은 짧은 이름 + 화살표), 4~16rem */
	const widths = $derived(
		Object.fromEntries(
			columns.map((c) => {
				const longest = Math.max(
					...(ENUMS[c] ?? []).map((o) => textRem(enumShort(o.label)) + 2),
					...rows.map((r) => {
						const v = isObject(r) ? r[c] : '';
						return textRem(Array.isArray(v) ? listToText(v) : v === null ? '' : String(v));
					})
				);
				return [c, Math.min(16, Math.max(4, Math.ceil((longest + 1.25) * 4) / 4))];
			})
		)
	);

	function move(i: number, d: -1 | 1) {
		const [row] = rows.splice(i, 1);
		rows.splice(i + d, 0, row);
	}
	function addRow() {
		rows.push(copyOf(rows[rows.length - 1]));
	}
	function setList(row: JsonObject, col: string, text: string, id: string) {
		const list = textToList(
			text,
			(row[col] as Json[]).some((v) => typeof v === 'number')
		);
		if (list === undefined) return invalidSet?.add(id);
		invalidSet?.delete(id);
		row[col] = list;
	}
	const SMALL =
		'grid h-9 w-7 shrink-0 place-items-center text-navy hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-strong disabled:opacity-30';
</script>

<div class="flex flex-col gap-2">
	<div class="max-h-[32rem] overflow-auto rounded-lg shadow-[inset_0_0_0_1px_rgb(42_66_91/0.12)]">
		<table class="w-full border-separate border-spacing-0 text-sm">
			<thead class="sticky top-0 z-10 bg-wash">
				<tr>
					{#each columns as col (col)}
						<th
							scope="col"
							class="px-1.5 py-2 text-left text-xs font-medium whitespace-nowrap text-navy"
							style:min-width="{widths[col]}rem"
							title={col}
						>
							<KeyLabel name={col} />
						</th>
					{/each}
					<th scope="col" class="w-0 px-1"><span class="sr-only">순서·빼기</span></th>
				</tr>
			</thead>
			<tbody>
				{#each rows as row, i (i)}
					{@const r = row as JsonObject}
					<tr class="odd:bg-surface even:bg-wash/60">
						{#each columns as col (col)}
							<td class="px-1 py-1 align-top">
								{#if !isObject(r) || !(col in r)}
									<span class="block px-2 py-2 text-xs text-navy/60">—</span>
								{:else if Array.isArray(r[col])}
									<input
										type="text"
										class="h-9 w-full min-w-24 rounded-md border border-navy/12 bg-slot px-2 text-sm text-ink focus:border-brand-strong focus:bg-surface"
										aria-label="{i + 1}번째 줄 {KEY_LABELS[col] ?? col}"
										value={listToText(r[col] as Json[])}
										oninput={(e) => setList(r, col, e.currentTarget.value, `${label}-${i}-${col}`)}
									/>
								{:else}
									<PrimitiveInput
										parent={r}
										key={col}
										label="{i + 1}번째 줄 {KEY_LABELS[col] ?? col}"
										numericHint={numeric.has(col)}
										compact
									/>
								{/if}
							</td>
						{/each}
						<td class="px-1 py-1 align-top">
							<div class="flex">
								<button
									type="button"
									class={SMALL}
									aria-label="{i + 1}번째 줄 위로"
									disabled={i === 0}
									onclick={() => move(i, -1)}>▲</button
								>
								<button
									type="button"
									class={SMALL}
									aria-label="{i + 1}번째 줄 아래로"
									disabled={i === rows.length - 1}
									onclick={() => move(i, 1)}>▼</button
								>
								<button
									type="button"
									class="{SMALL} text-xs"
									aria-label="{i + 1}번째 줄 빼기"
									disabled={rows.length === 1}
									onclick={() => rows.splice(i, 1)}>✕</button
								>
							</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<button
		type="button"
		class="self-start px-1 text-xs font-bold text-brand-strong hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-strong"
		onclick={addRow}>＋ 줄 더하기 (마지막 줄 복사)</button
	>
</div>
