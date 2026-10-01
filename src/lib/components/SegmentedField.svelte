<!--
	선택지 2~4개를 한 줄로 보여주는 라디오 묶음. 모드 전환처럼 늘 보여야 하는 선택에 쓴다.
	모양 (2026-10-01): 옅은 바탕 위에서 고른 쪽만 흰 알약(그림자) + brand-strong 굵은 글자.
	이전처럼 파란 면으로 꽉 채우면 입력 버튼이 화면에서 가장 무거워져 결과보다 눈에 띈다.
	선택 상태는 색만이 아니라 흰 면·그림자·굵기로도 구분한다.
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
	<legend class="mb-2 text-[0.8125rem] font-medium text-navy">{label}</legend>
	<div class="flex gap-1 rounded-lg bg-wash p-1">
		{#each options as option (option.value)}
			<label class="flex-1">
				<input type="radio" {name} value={option.value} bind:group={value} class="peer sr-only" />
				<span
					class="flex min-h-9 cursor-pointer items-center justify-center rounded-md px-3 text-sm text-navy transition-colors peer-checked:bg-surface peer-checked:font-bold peer-checked:text-brand-strong peer-checked:shadow-panel peer-focus-visible:outline-2 peer-focus-visible:outline-brand-strong hover:text-ink"
				>
					{option.label}
				</span>
			</label>
		{/each}
	</div>
</fieldset>
