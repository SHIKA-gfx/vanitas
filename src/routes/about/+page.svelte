<!--
	/ko/about — 정보와 출처 (공개 준비 3번, 2026-10-02).
	모든 페이지 맨 아래의 한 줄 푸터와 왼쪽 목록에서 이 페이지로 온다.
	비공식 고지, 저작권, 데이터 정확성, 저장 안내, 글꼴 출처, 라이선스, 문의.
	(익명 통계 고지는 공개 준비 5번에서 Umami를 연결할 때 더한다)

	바깥 주소(GitHub)는 마크업에 문자열 그대로 쓴다 — 변수로 넘기면 ESLint(no-navigation-without-resolve)가
	바깥 주소인지 알 수 없어 오류로 본다. 레포 주소가 바뀌면 이 파일에서 바꾼다. 레포 공개 전까지는 열리지 않는다.
-->
<script lang="ts">
	import Seo from '$lib/components/Seo.svelte';
	import { m } from '$lib/paraglide/messages.js';
	import Panel from '$lib/components/Panel.svelte';

	const sections = [
		{ title: m.about_unofficial_title(), body: [m.about_unofficial_body()] },
		{ title: m.about_copyright_title(), body: [m.about_copyright_body()] },
		{ title: m.about_data_title(), body: [m.about_data_body()] },
		{ title: m.about_storage_title(), body: [m.about_storage_body()] },
		{ title: m.about_fonts_title(), body: [m.about_fonts_gyeonggi(), m.about_fonts_oxanium()] }
	];

	const LINK =
		'text-brand-strong underline underline-offset-4 hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-strong';
</script>

<Seo
	title={`${m.about_page_title()} | ${m.app_title()}`}
	description={m.meta_about_description()}
/>

<main class="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-6">
	<div class="flex flex-col gap-2">
		<h1 class="text-[1.75rem] font-bold text-ink">{m.about_page_title()}</h1>
		<p class="text-navy">{m.about_intro()}</p>
	</div>

	<Panel>
		<div class="flex flex-col gap-6">
			{#each sections as s (s.title)}
				<section class="flex flex-col gap-2">
					<h2 class="text-base font-bold text-ink">{s.title}</h2>
					{#each s.body as line (line)}
						<p class="leading-relaxed text-ink">{line}</p>
					{/each}
				</section>
			{/each}

			<section class="flex flex-col gap-2">
				<h2 class="text-base font-bold text-ink">{m.about_license_title()}</h2>
				<p class="leading-relaxed text-ink">{m.about_license_body()}</p>
				<p class="flex flex-wrap gap-x-4 gap-y-1 text-sm">
					<a
						href="https://github.com/SHIKA-gfx/vanitas/blob/main/LICENSE"
						target="_blank"
						rel="noopener noreferrer"
						class={LINK}
					>
						{m.about_license_code()}
					</a>
					<a
						href="https://github.com/SHIKA-gfx/vanitas/blob/main/data/LICENSE"
						target="_blank"
						rel="noopener noreferrer"
						class={LINK}
					>
						{m.about_license_data()}
					</a>
				</p>
			</section>

			<section class="flex flex-col gap-2">
				<h2 class="text-base font-bold text-ink">{m.about_contact_title()}</h2>
				<p class="leading-relaxed text-ink">{m.about_contact_body()}</p>
				<p class="text-sm">
					<a
						href="https://github.com/SHIKA-gfx/vanitas/issues/new/choose"
						target="_blank"
						rel="noopener noreferrer"
						class={LINK}
					>
						{m.about_contact_link()}
					</a>
				</p>
			</section>
		</div>
	</Panel>
</main>
