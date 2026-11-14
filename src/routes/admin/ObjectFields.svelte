<!--
	묶음(객체)의 칸들 — 칸마다 FieldRow. $schema는 숨긴다.
	원시값 칸은 넓은 화면에서 두 칸씩, 묶음·목록 칸은 한 줄을 다 쓴다.
	min-w-0: 안의 표가 넓어도 칸이 밀려나지 않고 표만 옆으로 밀린다
-->
<script lang="ts">
	import FieldRow from './FieldRow.svelte';
	import { isPrimitive, type JsonObject } from './doc-edit';

	let { obj, depth = 0 }: { obj: JsonObject; depth?: number } = $props();
	const keys = $derived(Object.keys(obj).filter((k) => k !== '$schema'));
</script>

<div class="grid gap-x-4 gap-y-3 sm:grid-cols-2">
	{#each keys as key (key)}
		<div
			class={isPrimitive(obj[key]) &&
			!(typeof obj[key] === 'string' && (obj[key] as string).length > 48)
				? 'min-w-0'
				: 'min-w-0 sm:col-span-2'}
		>
			<FieldRow parent={obj} {key} {depth} />
		</div>
	{/each}
</div>
