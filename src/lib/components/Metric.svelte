<!--
	결과 숫자 하나 + 설명 한 줄. 데이터층 (디자인 문서 5-2) — 장식을 넣지 않는다.
-->
<script lang="ts">
	interface Props {
		label: string;
		value: string;
	}

	let { label, value }: Props = $props();
</script>

<div class="rounded bg-wash p-3">
	<div class="text-2xl text-ink tabular-nums">{value}</div>
	<div class="mt-1 text-xs text-navy">{label}</div>
</div>
