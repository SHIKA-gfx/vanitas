<!--
	체크박스. 브라우저 기본 모양 대신 직접 그린다 (2026-10-01):
	18px 둥근 사각형(모서리 4px), 켜지면 brand-strong 채움에 흰 체크.
	라벨 전체가 누르는 영역. 높이 44px로 모바일 터치 목표를 맞추고, 넓은 화면(마우스)에서는 32px.
-->
<script lang="ts">
	interface Props {
		label: string;
		checked: boolean;
	}

	let { label, checked = $bindable(false) }: Props = $props();
</script>

<label class="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-ink xl:min-h-8">
	<span class="relative flex shrink-0">
		<input
			type="checkbox"
			bind:checked
			class="peer size-[1.125rem] cursor-pointer appearance-none rounded border-[1.5px] border-navy/30 bg-surface transition-colors checked:border-brand-strong checked:bg-brand-strong hover:border-navy/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong"
		/>
		<svg
			class="pointer-events-none absolute inset-0 hidden size-[1.125rem] text-white peer-checked:block"
			viewBox="0 0 18 18"
			fill="none"
			stroke="currentColor"
			stroke-width="2.25"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<path d="m4.5 9.5 3 3 6-6.5" />
		</svg>
	</span>
	{label}
</label>
