import type { Handle } from '@sveltejs/kit';

/**
 * 검색엔진 소유 확인 파일.
 * Cloudflare Pages는 static/의 .html을 확장자 없는 주소로 308 넘기므로,
 * 정적 파일 대신 여기서 같은 주소·같은 내용으로 직접 응답한다.
 */
const VERIFICATION_FILES: Record<string, string> = {
	'/navera292e1644de22159a3ae21429fcfc88c.html':
		'naver-site-verification: navera292e1644de22159a3ae21429fcfc88c.html'
};

export const handleSiteVerification: Handle = ({ event, resolve }) => {
	const body = VERIFICATION_FILES[event.url.pathname];
	if (body !== undefined) {
		return new Response(body, {
			headers: { 'content-type': 'text/html; charset=utf-8' }
		});
	}
	return resolve(event);
};
