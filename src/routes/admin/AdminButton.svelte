<!--
	관리자 화면의 버튼. 사이트의 기울인 버튼 모양을 그대로 쓴다 (디자인 문서 5-19 — 누르면 무언가 바뀌는 조작은 60° 기울임,
	모서리 둔각 3·예각 8px, 글자는 반대로 기울여 세운다).
	- primary: 주 버튼 (ShareButton과 같은 brand-strong 면)
	- secondary: 보조 버튼 (BackupButton과 같은 흰 면)
	기울이면 위아래 가장자리가 좌우로 12px쯤 밀려나므로 좌우 여백(mx-3)을 둔다
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		variant?: 'primary' | 'secondary';
		type?: 'button' | 'submit';
		disabled?: boolean;
		onclick?: () => void;
		children: Snippet;
	}
	let {
		variant = 'secondary',
		type = 'button',
		disabled = false,
		onclick,
		children
	}: Props = $props();

	// Tailwind가 찾을 수 있도록 클래스 이름을 통째로 적는다 (조립하지 않는다)
	const VARIANT = {
		primary:
			'bg-brand-strong text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_8px_16px_-8px_rgb(10_111_214/0.8)] enabled:hover:bg-navy',
		secondary:
			'border border-navy/25 bg-surface/70 text-navy shadow-[inset_0_1px_0_#fff] enabled:hover:border-navy/45 enabled:hover:bg-surface enabled:hover:text-ink'
	} as const;
</script>

<button
	{type}
	{disabled}
	{onclick}
	class="mx-3 inline-flex min-h-11 shrink-0 -skew-x-30 items-center justify-center rounded-[3px_8px] px-5 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong disabled:opacity-60 {VARIANT[
		variant
	]}"
>
	<span class="inline-flex skew-x-30 items-center gap-2">{@render children()}</span>
</button>
