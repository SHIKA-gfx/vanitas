import { describe, expect, it } from 'vitest';
import { ADMIN_MARKER_KEY, hasAdminMarker, setAdminMarker } from './admin-marker';

function memory() {
	const map = new Map<string, string>();
	return {
		getItem: (k: string) => map.get(k) ?? null,
		setItem: (k: string, v: string) => void map.set(k, v),
		removeItem: (k: string) => void map.delete(k),
		map
	};
}

describe('관리자 표시', () => {
	it('켜고 끄면 홈이 읽는 값이 바뀐다', () => {
		const s = memory();
		expect(hasAdminMarker(s)).toBe(false);
		setAdminMarker(true, s);
		expect(s.map.get(ADMIN_MARKER_KEY)).toBe('1');
		expect(hasAdminMarker(s)).toBe(true);
		setAdminMarker(false, s);
		expect(hasAdminMarker(s)).toBe(false);
	});

	it('저장소가 없거나 막혀 있으면 없음으로 보고 멈추지 않는다', () => {
		const blocked = () => {
			throw new Error('blocked');
		};
		const broken = { getItem: blocked, setItem: blocked, removeItem: blocked };
		expect(hasAdminMarker(broken)).toBe(false);
		expect(() => setAdminMarker(true, broken)).not.toThrow();
		expect(hasAdminMarker(undefined)).toBe(false);
	});
});
