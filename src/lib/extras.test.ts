import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EXTRA_HUB_PATH, extras } from './extras';

describe('부가기능 목록 (docs/008 4-3)', () => {
	it('id가 겹치지 않고, 모두 허브 아래 한 단계 주소다', () => {
		expect(new Set(extras.map((e) => e.id)).size).toBe(extras.length);
		for (const e of extras) expect(e.path).toBe(`${EXTRA_HUB_PATH}/${e.id}`);
	});

	it('허브 페이지가 있고, 준비된 콘텐츠는 화면 파일이 있다 (없는 화면으로 링크하지 않게)', () => {
		expect(existsSync(`src/routes${EXTRA_HUB_PATH}/+page.svelte`)).toBe(true);
		for (const e of extras.filter((x) => x.ready)) {
			expect(existsSync(`src/routes${e.path}/+page.svelte`), e.path).toBe(true);
		}
	});
});
