<!--
	선택지 2~4개를 한 줄로 보여주는 라디오 묶음. 모드 전환처럼 늘 보여야 하는 선택에 쓴다.
	모양 (2026-10-01): 옅은 바탕 위에서 고른 쪽만 흰 알약(그림자) + brand-strong 굵은 글자.
	이전처럼 파란 면으로 꽉 채우면 입력 버튼이 화면에서 가장 무거워져 결과보다 눈에 띈다.
	선택 상태는 색만이 아니라 흰 면·그림자·굵기로도 구분한다.

	기울인 홈 (2026-10-23, 5-19): 트랙은 판에 파인 홈을 60° 기울인 것, 고른 쪽만 흰 조각으로 떠오른다.
	글자는 반대로 기울여 세운다. 모서리는 둔각 3·예각 8px(트랙), 안쪽 조각은 2·4px (바깥 8 − 여백 4).
	기울이면 위아래 가장자리가 좌우로 12px쯤 밀려나므로 트랙 좌우에 그만큼 여백(mx-3)을 둔다.
	좁은 판(넓은 화면의 세 열)에서는 선택지가 두 줄이 될 수 있어 글자를 가운데 맞춘다
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
	<legend class="mb-2 flex items-center gap-2 text-[0.8125rem] font-medium text-navy">
		<span aria-hidden="true" class="h-3 w-[3px] shrink-0 -skew-x-30 rounded-[1px_1.5px] bg-brand"
		></span>
		{label}
	</legend>
	<div
		class="mx-3 flex -skew-x-30 gap-1 rounded-[3px_8px] border border-navy/12 bg-slot p-1 shadow-[inset_0_2px_3px_rgb(42_66_91/0.1)]"
	>
		{#each options as option (option.value)}
			<label class="flex-1">
				<input type="radio" {name} value={option.value} bind:group={value} class="peer sr-only" />
				<span
					class="flex min-h-9 cursor-pointer items-center justify-center rounded-[2px_4px] px-2 text-sm text-navy transition-colors peer-checked:bg-surface peer-checked:font-bold peer-checked:text-brand-strong peer-checked:shadow-[inset_0_1px_0_#fff,0_1px_2px_rgb(42_66_91/0.12),0_4px_10px_-4px_rgb(18_136_248/0.45)] peer-focus-visible:outline-2 peer-focus-visible:outline-brand-strong hover:text-ink"
				>
					<span class="inline-block skew-x-30 text-center leading-tight">{option.label}</span>
				</span>
			</label>
		{/each}
	</div>
</fieldset>
