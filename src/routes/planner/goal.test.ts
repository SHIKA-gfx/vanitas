import { describe, expect, it } from 'vitest';
import { resolveRecruitId } from '$lib/data';
import { goalPullsRange } from '$lib/calc/planner-adapter';
import type { PlannerGoalKind } from '$lib/calc/planner';
import { goalOf, goalValue, isGoalValues, keepGoals, normalizeGoals } from './goal';
import { targetKey } from './target-key';

const MAX = goalPullsRange().max;

describe('목표 종류의 저장 값 (docs/007 10-4)', () => {
	it('"half"는 반천장까지, 1 ~ 천장 − 1의 정수는 N연까지, 그 밖은 확정', () => {
		expect(goalOf('half', MAX)).toEqual({ kind: 'half' });
		expect(goalOf('50', MAX)).toEqual({ kind: 'pulls', pulls: 50 });
		expect(goalOf('1', MAX)).toEqual({ kind: 'pulls', pulls: 1 });
		expect(goalOf(String(MAX), MAX)).toEqual({ kind: 'pulls', pulls: MAX });
		for (const bad of [undefined, '', '0', '05', '-3', '2.5', String(MAX + 1), 'pity', 'HALF'])
			expect(goalOf(bad, MAX)).toEqual({ kind: 'pity' });
	});

	it('확정은 적지 않는다', () => {
		expect(goalValue({ kind: 'pity' })).toBeNull();
		expect(goalValue({ kind: 'half' })).toBe('half');
		expect(goalValue({ kind: 'pulls', pulls: 50 })).toBe('50');
	});

	it('칸 검사는 문자열 값의 객체까지만 — 항목 하나가 틀려도 칸 전체를 버리지 않게', () => {
		expect(isGoalValues({})).toBe(true);
		expect(isGoalValues({ 'a~b': 'half', 'c~d': 'nonsense' })).toBe(true);
		expect(isGoalValues({ 'a~b': 50 })).toBe(false);
		expect(isGoalValues(['half'])).toBe(false);
		expect(isGoalValues(null)).toBe(false);
	});
});

describe('normalizeGoals — 불러올 때 지금 목표에 맞춘다', () => {
	const rio = targetKey('2026-11-17-fes-5-5th', 'rio');
	const makoto = targetKey('2026-11-10-pandemonium-cruise', 'makoto_swimsuit');
	const all: PlannerGoalKind[] = ['pity', 'half', 'pulls'];
	const resolve = (id: string) => resolveRecruitId(id);

	it('예전 기간 id의 키를 새 id로 잇는다 (previousIds) — 일정이 바로잡혀도 종류를 잃지 않는다', () => {
		expect(
			normalizeGoals({ '2026-11-24-fes-5-5th~rio': 'half' }, [rio], resolve, () => all, MAX)
		).toEqual({ [rio]: 'half' });
	});

	it('목표에 없는 키·틀린 값·확정 값은 뺀다', () => {
		const raw = {
			[rio]: '50',
			[makoto]: 'nonsense',
			'2026-12-01-gone~nobody': 'half',
			'2026-11-17-fes-5-5th~ibuki': 'half'
		};
		expect(normalizeGoals(raw, [rio, makoto], resolve, () => all, MAX)).toEqual({ [rio]: '50' });
	});

	it('그 목표가 고를 수 없는 종류는 뺀다 (픽업 학생이 여럿인 배너는 확정만)', () => {
		const kindsOf = (k: string): PlannerGoalKind[] => (k === rio ? ['pity'] : all);
		expect(
			normalizeGoals({ [rio]: 'half', [makoto]: '30' }, [rio, makoto], resolve, kindsOf, MAX)
		).toEqual({ [makoto]: '30' });
	});

	it('목표를 빼면 그 종류도 지운다', () => {
		expect(keepGoals({ [rio]: 'half', [makoto]: '30' }, [makoto])).toEqual({ [makoto]: '30' });
	});
});
