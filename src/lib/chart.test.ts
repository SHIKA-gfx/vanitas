import { describe, expect, it } from 'vitest';
import { keyStep, nearestIndex } from './chart';

describe('nearestIndex', () => {
	const days = [0, 1, 2, 5, 10, 20];

	it('같은 값이 있으면 그 자리', () => {
		expect(nearestIndex(days, 5)).toBe(3);
	});
	it('사이 값은 더 가까운 쪽', () => {
		expect(nearestIndex(days, 7)).toBe(3); // 5와 10 중 5
		expect(nearestIndex(days, 8)).toBe(4); // 10
		expect(nearestIndex(days, 15)).toBe(4); // 같은 거리면 앞쪽
	});
	it('범위 밖은 양 끝', () => {
		expect(nearestIndex(days, -3)).toBe(0);
		expect(nearestIndex(days, 99)).toBe(5);
	});
	it('빈 배열은 -1', () => {
		expect(nearestIndex([], 1)).toBe(-1);
	});
	it('점이 많아도 맞는 자리 (10년치)', () => {
		const many = Array.from({ length: 3651 }, (_, i) => i);
		expect(nearestIndex(many, 1234.4)).toBe(1234);
	});
});

describe('keyStep', () => {
	it('1% 또는 10%, 최소 1', () => {
		expect(keyStep(529, false)).toBe(5);
		expect(keyStep(529, true)).toBe(53);
		expect(keyStep(30, false)).toBe(1);
	});
});
