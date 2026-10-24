<!--
	체크박스. 브라우저 기본 모양 대신 직접 그린다 (2026-10-01):
	18px 둥근 사각형(모서리 4px), 켜지면 brand-strong 채움에 흰 체크.
	라벨 전체가 누르는 영역. 높이 44px로 모바일 터치 목표를 맞추고, 넓은 화면(마우스)에서는 32px.
	재질 (2026-10-23, 5-19): 꺼짐은 판에 파인 홈(slot + 안쪽 그림자), 켜짐은 brand-strong 채움 + 옅은 번짐.
	작은 정사각형은 기울이면 읽기 어려워 기울이지 않는다
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
			class="peer size-[1.125rem] cursor-pointer appearance-none rounded border-[1.5px] border-navy/30 bg-slot shadow-[inset_0_1px_2px_rgb(42_66_91/0.12)] transition-colors checked:border-brand-strong checked:bg-brand-strong checked:shadow-[0_0_0_3px_rgb(18_136_248/0.15),0_4px_10px_-4px_rgb(10_111_214/0.8)] hover:border-navy/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong"
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
