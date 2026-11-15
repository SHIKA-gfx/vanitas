/**
 * 목표 종류의 저장·공유 값 (docs/007 10-4, 2026-11-15).
 *
 * planner 묶음의 새 칸 `goals`: 목표 키("기간 id~학생 id") → "half"(반천장까지) 또는 "<N>"(N연까지, 1 ~ 천장 − 1).
 * 확정은 적지 않는다 — 옛 저장값·옛 링크에는 이 칸이 없어 모두 확정으로 읽힌다 (판 번호·tg 모양은 그대로).
 * 공유 링크 이름 gm (map-str): gm=2026-11-17-fes-5-5th~rio.half,2026-12-08-dive-into-ocean~kokoro.50
 * 기간·학생 id에는 '.' ',' '~'가 들어갈 수 없어(DB 제약) map 형식과 목표 키가 겹치지 않는다
 */
import type { PlannerGoal, PlannerGoalKind } from '$lib/calc/planner';
import { parseTargetKey, targetKey, type TargetKey } from './target-key';

/** 목표 키 → 저장 값 */
export type GoalValues = Record<TargetKey, string>;

/** "N연까지"를 처음 고를 때의 연 수 (화면 기본값 — 게임 규칙 값이 아니다) */
export const DEFAULT_GOAL_PULLS = 50;

const HALF = 'half';

/** 저장 값 → 목표 종류. 없거나 틀린 값은 확정 */
export function goalOf(value: string | undefined, maxPulls: number): PlannerGoal {
	if (value === HALF) return { kind: 'half' };
	if (value !== undefined && /^[1-9]\d*$/.test(value) && Number(value) <= maxPulls)
		return { kind: 'pulls', pulls: Number(value) };
	return { kind: 'pity' };
}

/** 목표 종류 → 저장 값. 확정은 적지 않으므로 null */
export function goalValue(goal: PlannerGoal): string | null {
	if (goal.kind === 'half') return HALF;
	if (goal.kind === 'pulls') return String(goal.pulls);
	return null;
}

/**
 * 칸 검사는 "문자열 값의 객체"까지만 — sanitize는 칸이 검사에 걸리면 칸을 통째로 버리기 때문.
 * 항목 거르기는 불러올 때 normalizeGoals가 한다
 */
export const isGoalValues = (v: unknown): boolean =>
	typeof v === 'object' &&
	v !== null &&
	!Array.isArray(v) &&
	Object.values(v).every((x) => typeof x === 'string');

/**
 * 저장값·공유 링크의 목표 종류를 지금 목표에 맞춘다.
 * 키는 normalizeTargetKeys처럼 예전 기간 id를 새 id로 잇고(previousIds), 목표 목록에 없는 키·틀린 값·
 * 그 목표가 고를 수 없는 종류(픽업 학생이 여럿인 배너 등)는 뺀다. 확정 값은 적지 않는다
 */
export function normalizeGoals(
	raw: Readonly<Record<string, string>>,
	targets: readonly TargetKey[],
	resolve: (recruitId: string) => string,
	kindsOf: (key: TargetKey) => readonly PlannerGoalKind[],
	maxPulls: number
): GoalValues {
	const out: GoalValues = {};
	for (const [key, value] of Object.entries(raw)) {
		const { recruitId, studentId } = parseTargetKey(key);
		const next = targetKey(resolve(recruitId), studentId);
		if (!targets.includes(next) || next in out) continue;
		const goal = goalOf(value, maxPulls);
		const stored = goalValue(goal);
		if (stored !== null && kindsOf(next).includes(goal.kind)) out[next] = stored;
	}
	return out;
}

/** 목표 목록에 남은 키만 (목표를 빼면 그 종류도 지운다) */
export function keepGoals(goals: GoalValues, targets: readonly TargetKey[]): GoalValues {
	return Object.fromEntries(Object.entries(goals).filter(([k]) => targets.includes(k)));
}
