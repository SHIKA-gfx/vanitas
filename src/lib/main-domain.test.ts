import { describe, expect, it } from 'vitest';
import { mainDomainRedirect } from './main-domain';

describe('mainDomainRedirect', () => {
	it('Pages 기본 주소는 같은 페이지의 vanitas.live로 (공유 링크 쿼리 그대로)', () => {
		expect(mainDomainRedirect(new URL('https://vanitas-xgi.pages.dev/'))).toBe(
			'https://vanitas.live/'
		);
		expect(
			mainDomainRedirect(new URL('https://vanitas-xgi.pages.dev/ko/levelup?lv=60&exp=1200'))
		).toBe('https://vanitas.live/ko/levelup?lv=60&exp=1200');
	});

	it('대표 주소, PR 미리보기 주소, 로컬은 그대로', () => {
		expect(mainDomainRedirect(new URL('https://vanitas.live/ko'))).toBeNull();
		expect(mainDomainRedirect(new URL('https://0c09c71e.vanitas-xgi.pages.dev/ko'))).toBeNull();
		expect(mainDomainRedirect(new URL('http://localhost:5173/ko'))).toBeNull();
	});
});
