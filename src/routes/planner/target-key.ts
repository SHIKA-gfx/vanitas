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
