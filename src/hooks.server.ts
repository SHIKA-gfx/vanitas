import { redirect, type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { getTextDirection } from '$lib/paraglide/runtime';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { mainDomainRedirect } from '$lib/main-domain';
import { handleSiteVerification } from '$lib/site-verification';

const handleMainDomain: Handle = ({ event, resolve }) => {
	const target = mainDomainRedirect(event.url);
	if (target) {
		redirect(301, target);
	}
	return resolve(event);
};

/** 두 로케일 모두 URL 접두어를 쓰므로, 접두어 없는 루트 접속은 기본 로케일로 보낸다. */
const handleRootRedirect: Handle = ({ event, resolve }) => {
	if (event.url.pathname === '/') {
		redirect(307, '/ko');
	}
	return resolve(event);
};

/**
 * 관리자 페이지는 검색에서 뺀다 (docs/006 6-1, 결정 G). 브라우저에서만 그리는 화면이라(ssr = false)
 * 페이지 안의 meta만으로는 글을 읽지 않는 검색 로봇에게 닿지 않는다 → 응답 머리에 붙인다
 */
const handleAdminNoindex: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	if (event.route.id?.startsWith('/admin')) {
		response.headers.set('X-Robots-Tag', 'noindex, nofollow');
	}
	return response;
};

const handleParaglide: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request, locale }) => {
		event.request = request;

		return resolve(event, {
			transformPageChunk: ({ html }) =>
				html
					.replace('%paraglide.lang%', locale)
					.replace('%paraglide.dir%', getTextDirection(locale))
		});
	});

export const handle: Handle = sequence(
	handleSiteVerification,
	handleMainDomain,
	handleRootRedirect,
	handleParaglide,
	handleAdminNoindex
);
