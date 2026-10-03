import { describe, expect, it } from 'vitest';
import { decodeShare, encodeShare, type ShareField } from './share';

const fields: ShareField[] = [
	{ key: 'level', param: 'lv', kind: 'int' },
	{ key: 'mode', param: 'm', kind: 'str' },
	{ key: 'off', param: 'off', kind: 'list' },
	{ key: 'comfort', param: 'cf', kind: 'map-int' },
	{ key: 'sub', param: 'sub', kind: 'map-str' }
];
const defaults = { level: 1, mode: 'level', off: [], comfort: {}, sub: { 'monthly-pass': '0' } };

describe('encodeShare', () => {
	it('기본값과 같은 칸은 담지 않는다', () => {
		expect(encodeShare(defaults, defaults, fields).toString()).toBe('');
	});

	it('다른 칸만 짧은 이름으로', () => {
		const values = {
			...defaults,
			level: 60,
			off: ['daily-mission', 'weekly-mission'],
			comfort: { '8': 4500 },
			sub: { 'monthly-pass': 'continuous' }
		};
		const q = encodeShare(values, defaults, fields);
		expect(Object.fromEntries(q)).toEqual({
			lv: '60',
			off: 'daily-mission,weekly-mission',
			cf: '8.4500',
			sub: 'monthly-pass.continuous'
		});
	});
});

describe('decodeShare', () => {
	it('주소 → 값, 왕복하면 같다', () => {
		const values = {
			...defaults,
			level: 75,
			mode: 'date',
			off: ['a'],
			comfort: { '8': 4500, '9': 5000 }
		};
		const decoded = decodeShare(encodeShare(values, defaults, fields), fields);
		expect(decoded.found).toBe(true);
		expect({ ...defaults, ...decoded.values }).toEqual(values);
	});

	it('공유 칸이 하나도 없으면 found=false (그냥 연 것)', () => {
		expect(decodeShare(new URLSearchParams('utm=x'), fields)).toEqual({ values: {}, found: false });
	});

	it('빈 목록은 빈 목록으로 (없는 것과 다르다)', () => {
		expect(decodeShare(new URLSearchParams('off='), fields).values.off).toEqual([]);
	});

	it('읽을 수 없는 값은 건너뛴다', () => {
		const d = decodeShare(new URLSearchParams('lv=abc&cf=8.x'), fields);
		expect(d.found).toBe(true);
		expect(d.values).toEqual({});
	});

	it('키에 마침표가 있어도 마지막 마침표로 나눈다', () => {
		expect(decodeShare(new URLSearchParams('sub=a.b.c'), fields).values.sub).toEqual({
			'a.b': 'c'
		});
	});
});
