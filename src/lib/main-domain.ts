// 대표 주소로 넘기기 (2026-10-04).
//
// 디시인사이드가 ".live"를 금지어로 막아 vanitas.live 링크를 걸 수 없다(아카라이브 arca.live 차단 때문).
// 그래서 Cloudflare Pages 기본 주소(vanitas-xgi.pages.dev)를 대신 걸고, 그 주소로 들어오면 같은 페이지의
// vanitas.live로 넘긴다. 넘기지 않으면
//   - 브라우저 저장값이 주소마다 따로라, 나중에 vanitas.live로 오면 입력한 값이 없다
//   - 통계(Umami)는 vanitas.live 방문만 세서, 유입이 통째로 빠진다
//
// 넘기는 대상은 기본 주소 딱 하나. PR 미리보기 주소(<해시>.vanitas-xgi.pages.dev)는 그대로 둔다 —
// Merge 전에 실제 환경에서 확인하는 용도라서.

export const SITE_ORIGIN = 'https://vanitas.live';
const PAGES_DEV_HOST = 'vanitas-xgi.pages.dev';

/** 넘겨야 하면 넘길 주소(경로와 쿼리 그대로), 아니면 null */
export function mainDomainRedirect(url: URL): string | null {
	if (url.hostname !== PAGES_DEV_HOST) return null;
	return `${SITE_ORIGIN}${url.pathname}${url.search}`;
}
