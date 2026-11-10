/**
 * 목표 하나의 이름: "기간 id~학생 id".
 * 저장값과 공유 링크(tg=…)가 이 문자열을 쓴다. '~'는 주소에서 바뀌지 않는 글자라 링크가 읽기 쉽다.
 */
export type TargetKey = string;

const SEP = '~';

export function targetKey(recruitId: string, studentId: string): TargetKey {
	return `${recruitId}${SEP}${studentId}`;
}

export function parseTargetKey(key: TargetKey): { recruitId: string; studentId: string } {
	const at = key.lastIndexOf(SEP);
	return { recruitId: key.slice(0, at), studentId: key.slice(at + 1) };
}

/** 저장값·공유 링크의 목표 목록 형식 — 내용(있는 목표인가)은 normalizeTargetKeys가 맞춘다 */
export const isTargetKeyList = (v: unknown): boolean =>
	Array.isArray(v) && v.every((x) => typeof x === 'string' && x.includes(SEP));

/**
 * 저장값·공유 링크의 목표를 지금 데이터에 맞춘다 (2026-11-10).
 * 예전 기간 id는 새 id로 잇고(previousIds), 없는 목표(지운 기간·학생)는 빼고, 같은 목표가 둘이면 앞의 것만 남긴다.
 * 순서(우선순위)는 그대로. 목록 하나가 낡았다고 목표 전체를 버리지 않으려고 둔다
 */
export function normalizeTargetKeys(
	keys: readonly string[],
	allowed: ReadonlySet<TargetKey>,
	resolve: (recruitId: string) => string
): TargetKey[] {
	const out: TargetKey[] = [];
	for (const key of keys) {
		const { recruitId, studentId } = parseTargetKey(key);
		const next = targetKey(resolve(recruitId), studentId);
		if (allowed.has(next) && !out.includes(next)) out.push(next);
	}
	return out;
}
