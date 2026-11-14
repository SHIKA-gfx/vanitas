<!--
	/ko/privacy — 개인정보 처리방침 (docs/007 7장, ⑥-2).
	로그인 창과 정보와 출처 페이지에서 이 페이지로 온다. 구글 OAuth 동의 화면의 "개인정보처리방침 링크"도 이 주소다.
	모양은 정보와 출처 페이지와 같다. 법률 자문을 거친 글이 아니다 — 개인정보보호위원회의 처리방침 작성 안내를 보고 맞춘다.
	시행일은 로그인을 모두에게 여는 날(⑥-3)에 맞춘다.
-->
<script lang="ts">
	import Seo from '$lib/components/Seo.svelte';
	import Panel from '$lib/components/Panel.svelte';
	import { m } from '$lib/paraglide/messages.js';

	const EFFECTIVE = '2026-11-15';

	/** 문단(p)과 목록(ul)을 적힌 순서대로 */
	type Part = string | string[];
	const sections: { title: string; parts: Part[] }[] = [
		{
			title: m.privacy_items_title(),
			parts: [
				[m.privacy_items_google(), m.privacy_items_kakao(), m.privacy_items_saves()],
				m.privacy_items_note()
			]
		},
		{ title: m.privacy_purpose_title(), parts: [m.privacy_purpose_body()] },
		{ title: m.privacy_retention_title(), parts: [m.privacy_retention_body()] },
		{
			title: m.privacy_sharing_title(),
			parts: [
				m.privacy_sharing_body(),
				[m.privacy_sharing_supabase(), m.privacy_sharing_cloudflare()]
			]
		},
		{ title: m.privacy_rights_title(), parts: [m.privacy_rights_body()] },
		{ title: m.privacy_analytics_title(), parts: [m.privacy_analytics_body()] },
		{ title: m.privacy_changes_title(), parts: [m.privacy_changes_body()] }
	];

	const LINK =
		'text-brand-strong underline underline-offset-4 hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-strong';
</script>

<Seo title={`${m.privacy_title()} | ${m.app_title()}`} description={m.meta_privacy_description()} />

<main class="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-6">
	<div class="flex flex-col gap-2">
		<h1 class="text-[1.75rem] font-bold text-ink">{m.privacy_title()}</h1>
		<p class="text-navy">{m.privacy_intro()}</p>
		<p class="text-sm text-navy">{m.privacy_effective({ date: EFFECTIVE })}</p>
	</div>

	<Panel>
		<div class="flex flex-col gap-6">
			{#each sections as s (s.title)}
				<section class="flex flex-col gap-2">
					<h2 class="text-base font-bold text-ink">{s.title}</h2>
					{#each s.parts as part, i (i)}
						{#if Array.isArray(part)}
							<ul class="flex list-disc flex-col gap-1 pl-5 leading-relaxed text-ink">
								{#each part as item (item)}
									<li>{item}</li>
								{/each}
							</ul>
						{:else}
							<p class="leading-relaxed text-ink">{part}</p>
						{/if}
					{/each}
				</section>
			{/each}

			<section class="flex flex-col gap-2">
				<h2 class="text-base font-bold text-ink">{m.privacy_contact_title()}</h2>
				<p class="leading-relaxed text-ink">{m.privacy_contact_body()}</p>
				<p class="text-sm">
					<a
						href="https://github.com/SHIKA-gfx/vanitas/issues/new/choose"
						data-umami-event="outbound"
						data-umami-event-to="issues"
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
