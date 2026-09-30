// 웹폰트는 KS X 1001 한글 2,350자만 담고 있다 (scripts/subset-fonts.py).
// 화면 문구나 게임 데이터에 그 밖의 글자가 들어오면 그 글자만 다른 글꼴로 보이므로 여기서 막는다.
// 실패하면: scripts/subset-fonts.py의 EXTRA에 글자를 더해 글꼴을 다시 만든다.

import { describe, expect, it } from 'vitest';

// Vite가 파일 내용을 문자열로 읽어 준다 (node:fs 없이 — 타입 검사 환경을 가리지 않게)
const sources = import.meta.glob(['/messages/ko.json', '/data/**/*.json'], {
	eager: true,
	query: '?raw',
	import: 'default'
}) as Record<string, string>;

function ksHangul(): Set<string> {
	const decoder = new TextDecoder('euc-kr');
	const set = new Set<string>();
	for (let hi = 0xb0; hi <= 0xc8; hi++) {
		for (let lo = 0xa1; lo <= 0xfe; lo++) {
			const c = decoder.decode(new Uint8Array([hi, lo]));
			if (c >= '\uac00' && c <= '\ud7a3') set.add(c);
		}
	}
	return set;
}

describe('웹폰트 글자 범위', () => {
	const allowed = ksHangul();

	it('KS X 1001 한글은 2,350자', () => {
		expect(allowed.size).toBe(2350);
	});

	it('화면 문구와 게임 데이터의 한글이 모두 들어 있다', () => {
		expect(Object.keys(sources)).toContain('/messages/ko.json');
		const missing = new Map<string, string>();
		for (const [file, text] of Object.entries(sources)) {
			for (const ch of text) {
				if (ch >= '\uac00' && ch <= '\ud7a3' && !allowed.has(ch)) missing.set(ch, file);
			}
		}
		expect(Object.fromEntries(missing)).toEqual({});
	});
});
