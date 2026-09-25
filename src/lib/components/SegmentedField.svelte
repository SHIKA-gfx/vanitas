<!--
	선택지 2~4개를 한 줄로 보여주는 라디오 묶음. 모드 전환처럼 늘 보여야 하는 선택에 쓴다.
	선택 상태는 색만이 아니라 채움(면)으로 구분한다.
-->
<script lang="ts">
	interface Option {
		value: string;
		label: string;
	}

	interface Props {
		label: string;
		value: string;
		options: Option[];
	}

	let { label, value = $bindable(), options }: Props = $props();
	const name = $props.id();
</script>

<fieldset>
	<legend class="mb-1 text-sm text-navy">{label}</legend>
	<div class="flex rounded border border-navy/60">
		{#each options as option (option.value)}
			<label class="flex-1">
				<input type="radio" {name} value={option.value} bind:group={value} class="peer sr-only" />
				<span
					class="flex min-h-11 cursor-pointer items-center justify-center px-3 text-sm text-navy peer-checked:bg-brand-strong peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-brand-strong"
				>
					{option.label}
				</span>
			</label>
		{/each}
	</div>
</fieldset>
