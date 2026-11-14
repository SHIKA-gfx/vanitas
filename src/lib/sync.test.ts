import { describe, expect, it } from 'vitest';
import {
	canonical,
	decideOnStart,
	fingerprint,
	readMeta,
	summarize,
	SYNC_KEY,
	writeMeta
} from './sync';
import type { SaveFile } from './state/persist';

const file = (gems: number, targets = 0): SaveFile => ({
	version: 1,
	sections: { user: { gems }, planner: { targets: Array.from({ length: targets }, (_, i) => i) } }
});

function memory(): Storage {
	const m = new Map<string, string>();
	return {
		getItem: (k) => m.get(k) ?? null,
		setItem: (k, v) => void m.set(k, v),
		removeItem: (k) => void m.delete(k),
		clear: () => m.clear(),
		key: () => null,
		get length() {
			return m.size;
		}
	};
}

describe('지문', () => {
	it('키 순서와 상관없이 같은 값이면 같다', () => {
		expect(canonical({ b: 1, a: [1, { d: 2, c: 3 }] })).toBe('{"a":[1,{"c":3,"d":2}],"b":1}');
		expect(fingerprint({ b: 1, a: 2 })).toBe(fingerprint({ a: 2, b: 1 }));
		expect(fingerprint(file(1))).not.toBe(fingerprint(file(2)));
		expect(fingerprint(file(1))).toMatch(/^[0-9a-f]{8}$/);
	});
});

describe('맞춘 기록', () => {
	it('읽고 쓰고 지운다. 깨졌으면 없음', () => {
		const s = memory();
		expect(readMeta(s)).toBeNull();
		writeMeta({ userId: 'u', syncedAt: 't1', syncedHash: 'h' }, s);
		expect(readMeta(s)).toEqual({ userId: 'u', syncedAt: 't1', syncedHash: 'h' });
		s.setItem(SYNC_KEY, '{broken');
		expect(readMeta(s)).toBeNull();
		writeMeta(null, s);
		expect(s.getItem(SYNC_KEY)).toBeNull();
		expect(readMeta(undefined)).toBeNull();
	});
});

describe('로그인·다시 열 때 (docs/007 4장 표)', () => {
	const local = file(100, 2);
	const remote = (data: SaveFile, updatedAt = 't2') => ({ data, updatedAt });
	const meta = (syncedAt: string, syncedFile: SaveFile, userId = 'u') => ({
		userId,
		syncedAt,
		syncedHash: fingerprint(syncedFile)
	});

	it('계정에 아직 없으면 올린다', () => {
		expect(decideOnStart(null, 'u', local, null)).toEqual({ kind: 'upload', expected: null });
		expect(decideOnStart(meta('t1', local), 'u', local, null)).toEqual({
			kind: 'upload',
			expected: null
		});
	});

	it('값이 같으면 그대로', () => {
		expect(decideOnStart(null, 'u', local, remote(file(100, 2)))).toEqual({ kind: 'same' });
	});

	it('처음 로그인(이 기기에서 이 사람과 맞춘 적 없음)에 값이 다르면 묻는다', () => {
		expect(decideOnStart(null, 'u', local, remote(file(5)))).toEqual({ kind: 'ask' });
		expect(decideOnStart(meta('t2', file(5), 'other'), 'u', local, remote(file(5)))).toEqual({
			kind: 'ask'
		});
	});

	it('판이 그대로: 이 기기에서 고쳤으면 올리고, 아니면 그대로', () => {
		const synced = file(50);
		expect(decideOnStart(meta('t2', synced), 'u', local, remote(synced))).toEqual({
			kind: 'upload',
			expected: 't2'
		});
	});

	it('판이 바뀜: 이 기기에서 안 고쳤으면 받고, 고쳤으면 묻는다', () => {
		expect(decideOnStart(meta('t1', local), 'u', local, remote(file(7), 't2'))).toEqual({
			kind: 'apply'
		});
		expect(decideOnStart(meta('t1', file(1)), 'u', local, remote(file(7), 't2'))).toEqual({
			kind: 'ask'
		});
	});
});

describe('요약', () => {
	it('보유 청휘석과 플래너 목표 수', () => {
		expect(summarize(file(1234, 3))).toEqual({ gems: 1234, targets: 3 });
		expect(summarize({ version: 1, sections: {} })).toEqual({ gems: null, targets: null });
		expect(summarize(null)).toEqual({ gems: null, targets: null });
	});
});
