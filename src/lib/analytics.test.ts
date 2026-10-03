import { afterEach, describe, expect, it, vi } from 'vitest';
import { calcName, track } from './analytics';

afterEach(() => vi.unstubAllGlobals());

describe('track', () => {
	it('통계 스크립트가 있으면 이벤트를 보낸다', () => {
		const sent: unknown[] = [];
		vi.stubGlobal('window', { umami: { track: (...a: unknown[]) => sent.push(a) } });
		track('share-copy', { calc: 'pity' });
		expect(sent).toEqual([['share-copy', { calc: 'pity' }]]);
	});

	it('스크립트가 없거나(개발 서버) 실패해도 오류 없이 넘어간다', () => {
		vi.stubGlobal('window', {});
		expect(() => track('reset')).not.toThrow();
		vi.stubGlobal('window', {
			umami: {
				track: () => {
					throw new Error('blocked');
				}
			}
		});
		expect(() => track('reset')).not.toThrow();
	});
});

describe('calcName', () => {
	it('주소를 계산기 이름으로', () => {
		expect(calcName('/levelup')).toBe('levelup');
		expect(calcName('/')).toBe('home');
		expect(calcName(null)).toBe('home');
	});
});
