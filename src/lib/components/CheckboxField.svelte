<script lang="ts">
	interface Props {
		label: string;
		checked: boolean;
	}

	let { label, checked = $bindable(false) }: Props = $props();
</script>

<!-- 라벨 전체가 누르는 영역. 높이 44px로 모바일 터치 목표를 맞춘다 -->
<label class="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink">
	<input type="checkbox" bind:checked class="size-4 accent-brand-strong" />
	{label}
</label>
