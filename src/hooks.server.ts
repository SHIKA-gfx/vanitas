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
	handleParaglide
);
