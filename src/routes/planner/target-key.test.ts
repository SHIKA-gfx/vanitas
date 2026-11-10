import { describe, expect, it } from 'vitest';
import { resolveRecruitId } from '$lib/data';
import { isTargetKeyList, normalizeTargetKeys, targetKey } from './target-key';

describe('normalizeTargetKeys — 일정이 바로잡혀도 목표를 잃지 않는다 (2026-11-10)', () => {
	const allowed = new Set([
		targetKey('2026-11-10-pandemonium-cruise', 'makoto_swimsuit'),
		targetKey('2026-11-17-fes-5-5th', 'rio')
	]);

	it('예전 기간 id는 새 id로 잇고, 우선순위 순서는 그대로', () => {
		const saved = ['2026-11-24-fes-5-5th~rio', '2026-11-17-pandemonium-cruise~makoto_swimsuit'];
		expect(normalizeTargetKeys(saved, allowed, (id) => resolveRecruitId(id))).toEqual([
			'2026-11-17-fes-5-5th~rio',
			'2026-11-10-pandemonium-cruise~makoto_swimsuit'
		]);
	});

	it('없는 목표(지운 기간)는 빼고 나머지는 남긴다', () => {
		const saved = ['2026-11-10-serenade-permanent~chiaki', '2026-11-17-fes-5-5th~rio'];
		expect(normalizeTargetKeys(saved, allowed, (id) => resolveRecruitId(id))).toEqual([
			'2026-11-17-fes-5-5th~rio'
		]);
	});

	it('예전 id와 새 id가 함께 있으면 앞의 것 하나만', () => {
		const saved = ['2026-11-17-fes-5-5th~rio', '2026-11-24-fes-5-5th~rio'];
		expect(normalizeTargetKeys(saved, allowed, (id) => resolveRecruitId(id))).toEqual([
			'2026-11-17-fes-5-5th~rio'
		]);
	});

	it('목록 형식만 검사한다 — 내용은 normalizeTargetKeys가 맞춘다', () => {
		expect(isTargetKeyList(['2026-11-24-fes-5-5th~rio'])).toBe(true);
		expect(isTargetKeyList(['rio'])).toBe(false);
		expect(isTargetKeyList('2026-11-17-fes-5-5th~rio')).toBe(false);
	});
});
