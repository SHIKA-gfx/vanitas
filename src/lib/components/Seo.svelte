<!--
	페이지 정보 (공개 준비 4번, 2026-10-03): 브라우저 탭 제목, 검색 결과 설명, 링크 미리보기(카카오톡·디스코드·X 등).
	페이지마다 하나씩 둔다. 미리보기 이미지는 모든 페이지가 같은 것(static/og-image.png, scripts/make-icons.py가 만든다).
	canonical은 쿼리를 뺀 주소 — 공유 링크(?lv=60…)로 들어와도 검색엔진에는 같은 페이지로 알린다.
-->
<script lang="ts">
	import { page } from '$app/state';

	let { title, description }: { title: string; description: string } = $props();

	const url = $derived(`${page.url.origin}${page.url.pathname}`);
	const image = $derived(`${page.url.origin}/og-image.png`);
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={url} />

	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="VANITAS" />
	<meta property="og:locale" content="ko_KR" />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={url} />
	<meta property="og:image" content={image} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:alt" content="VANITAS — 블루 아카이브 재화·픽업 플래너" />
	<meta name="twitter:card" content="summary_large_image" />
</svelte:head>
