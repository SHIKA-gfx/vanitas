import { describe, expect, it } from 'vitest';
import {
	emptySaveFile,
	isFutureDate,
	isInt,
	isOneOf,
	isRecordOf,
	isSubsetOf,
	parseSaveFile,
	sanitize,
	withSection
} from './persist';

describe('저장 파일', () => {
	it('없거나 깨졌거나 모르는 판이면 빈 파일', () => {
		expect(parseSaveFile(null)).toEqual(emptySaveFile());
		expect(parseSaveFile('{깨짐')).toEqual(emptySaveFile());
		expect(parseSaveFile('"문자열"')).toEqual(emptySaveFile());
		expect(parseSaveFile(JSON.stringify({ version: 99, sections: { a: 1 } }))).toEqual(
			emptySaveFile()
		);
	});

	it('쓰고 다시 읽으면 같다', () => {
		const file = withSection(emptySaveFile(), 'levelup', { level: 60 });
		expect(parseSaveFile(JSON.stringify(file)).sections.levelup).toEqual({ level: 60 });
	});

	it('한 묶음을 써도 다른 묶음은 남는다', () => {
		const a = withSection(emptySaveFile(), 'user', { gems: 1 });
		const b = withSection(a, 'income', { endDate: '2027-01-01' });
		expect(Object.keys(b.sections)).toEqual(['user', 'income']);
	});
});

describe('칸 검사', () => {
	it('정수 범위', () => {
		expect(isInt(1, 90)(60)).toBe(true);
		expect(isInt(1, 90)(91)).toBe(false);
		expect(isInt(0)(1.5)).toBe(false);
		expect(isInt(0)('3')).toBe(false);
	});
	it('선택지', () => {
		expect(isOneOf(['a', 'b'])('a')).toBe(true);
		expect(isOneOf(['a', 'b'])('c')).toBe(false);
	});
	it('지나간 날짜는 받지 않는다', () => {
		const future = isFutureDate('2026-10-02');
		expect(future('2026-10-03')).toBe(true);
		expect(future('2026-10-02')).toBe(false);
		expect(future('2026-9-30')).toBe(false);
	});
	it('목록의 부분집합, 키가 정해진 객체', () => {
		expect(isSubsetOf(['x', 'y'])(['y'])).toBe(true);
		expect(isSubsetOf(['x', 'y'])(['z'])).toBe(false);
		const rec = isRecordOf(['1', '2'], (_, v) => v === 0);
		expect(rec({ '1': 0 })).toBe(true);
		expect(rec({ '3': 0 })).toBe(false);
		expect(rec([])).toBe(false);
	});
});

describe('sanitize', () => {
	const defaults = { level: 1, mode: 'level', date: '2026-11-01' };
	const checks = {
		level: isInt(1, 90),
		mode: isOneOf(['level', 'date']),
		date: isFutureDate('2026-10-02')
	};

	it('맞는 칸은 저장값, 틀린 칸만 기본값', () => {
		expect(sanitize({ level: 60, mode: 'nope', date: '2026-12-01' }, defaults, checks)).toEqual({
			level: 60,
			mode: 'level',
			date: '2026-12-01'
		});
	});
	it('지나간 날짜는 기본값으로', () => {
		expect(sanitize({ date: '2026-09-01' }, defaults, checks).date).toBe('2026-11-01');
	});
	it('옛 칸은 버리고, 새 칸은 기본값으로 채운다', () => {
		expect(sanitize({ level: 50, removed: true }, defaults, checks)).toEqual({
			...defaults,
			level: 50
		});
	});
	it('저장값이 아예 없으면 기본값 그대로', () => {
		expect(sanitize(undefined, defaults, checks)).toEqual(defaults);
	});
});
