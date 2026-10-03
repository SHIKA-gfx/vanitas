<!--
	한 줄 푸터 (공개 준비 3번, 2026-10-02): "비공식 팬 도구 · 정보와 출처".
	전체 고지는 정보 페이지(/about)에 두고, 계산기 화면은 한 화면에 담기도록 푸터를 짧게 유지한다.
-->
<script lang="ts">
	import type { Pathname } from '$app/types';
	import { resolve } from '$app/paths';
	import { localizeHref } from '$lib/paraglide/runtime';
	import { m } from '$lib/paraglide/messages.js';

	const aboutHref = resolve(localizeHref('/about') as Pathname);
</script>

<p class="text-center text-xs text-navy">
	{m.footer_unofficial()}
	<span aria-hidden="true">·</span>
	<a
		href={aboutHref}
		class="underline underline-offset-4 hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-strong"
	>
		{m.footer_about()}
	</a>
</p>
