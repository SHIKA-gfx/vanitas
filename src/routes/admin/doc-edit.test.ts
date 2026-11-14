import { describe, expect, it } from 'vitest';
import scheduleJson from '../../../data/ko/schedule.json';
import levelTableJson from '../../../data/shared/level-table.json';
import incomeJson from '../../../data/ko/income-sources.json';
import { diffChecks } from './build-check';
import {
	changedPaths,
	columnIsNumeric,
	copyOf,
	isPlaceholder,
	listToText,
	parseJsonText,
	readPrimitive,
	tableColumns,
	textToList,
	typeChanges
} from './doc-edit';

describe('표로 보이기', () => {
	it('레이드 일정·레벨 표는 표, 수급원(등급 목록이 든)은 표가 아니다', () => {
		expect(tableColumns(scheduleJson.raids)).toEqual(
			expect.arrayContaining(['kind', 'season', 'name', 'start', 'end', 'status'])
		);
		expect(tableColumns(levelTableJson.levels)).toEqual([
			'level',
			'expToNext',
			'expCumulative',
			'apMax'
		]);
		expect(tableColumns(incomeJson.sources)).toBeNull();
		expect(tableColumns([])).toBeNull();
		expect(columnIsNumeric(scheduleJson.raids, 'season')).toBe(true);
	});

	it('자리 표시', () => {
		expect(isPlaceholder({ $table: 'recruits' })).toBe(true);
		expect(isPlaceholder({ $table: 'recruits', x: 1 })).toBe(false);
		expect(isPlaceholder([])).toBe(false);
	});
});

describe('값 읽기', () => {
	it('숫자 칸은 숫자만, 빈칸은 비우면 null', () => {
		expect(readPrimitive('12', 3)).toBe(12);
		expect(readPrimitive('0.007', 3)).toBe(0.007);
		expect(readPrimitive('', 3)).toBeUndefined();
		expect(readPrimitive('abc', 3)).toBeUndefined();
		expect(readPrimitive('', null)).toBeNull();
		expect(readPrimitive('7', null, true)).toBe(7);
		expect(readPrimitive('7', null)).toBe('7');
		expect(readPrimitive('', 'x')).toBe('');
	});

	it('목록 ↔ 쉼표 글자', () => {
		expect(listToText(['30', '34'])).toBe('30, 34');
		expect(textToList('30, 34,', false)).toEqual(['30', '34']);
		expect(textToList('7, 14', true)).toEqual([7, 14]);
		expect(textToList('7, x', true)).toBeUndefined();
	});
});

describe('바뀐 곳', () => {
	it('잎 단위, 줄 수, 새 칸·지운 칸', () => {
		const before = copyOf(scheduleJson) as Record<string, unknown> & typeof scheduleJson;
		const after = copyOf(before);
		after.raids[2].end = '2099-01-01';
		after.events.pop();
		(after.meta as Record<string, unknown>).extra = 1;
		expect(changedPaths(before, after)).toEqual([
			'meta.extra (새 칸)',
			'raids[2].end',
			`events (${before.events.length}줄 → ${after.events.length}줄)`
		]);
		expect(changedPaths(before, copyOf(before))).toEqual([]);
	});

	it('형이 바뀐 곳 (빈칸 채우기는 빼고)', () => {
		expect(typeChanges({ a: 1, b: null, c: [1] }, { a: '1', b: 'x', c: [1] })).toEqual([
			'a: 숫자 → 글자'
		]);
	});

	it('JSON 원문 읽기 — 틀린 곳의 줄', () => {
		expect(parseJsonText('{"a": 1}')).toEqual({ ok: true, value: { a: 1 } });
		expect(parseJsonText('[1]')).toMatchObject({ ok: false });
		const bad = parseJsonText('{\n  "a": 1,\n  "b": \n}');
		expect(bad.ok).toBe(false);
	});
});

describe('빌드 검사 비교', () => {
	it('새로 생긴 것만 고침 탓', () => {
		const d = diffChecks(
			{ errors: [], warnings: ['w1', 'w2'] },
			{ errors: ['e1'], warnings: ['w1', 'w3'] }
		);
		expect(d.newErrors).toEqual(['e1']);
		expect(d.newWarnings).toEqual(['w3']);
		expect(d.resolved).toEqual(['w2']);
		expect(d.unchanged).toEqual(['w1']);
	});
});
