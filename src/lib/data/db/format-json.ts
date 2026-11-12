/**
 * 데이터 파일 서식 (docs/006 7-3, 결정 E: 압축 서식).
 *
 * 한 줄(들여쓰기·키·뒤의 쉼표 포함 WIDTH자)에 들어가는 배열·객체는 안의 묶음까지 한 줄로 쓰고,
 * 들어가지 않으면 2칸 들여쓰기로 펴고 안쪽에 같은 규칙을 적용한다. 끝에 줄바꿈 하나.
 * 글자 수는 JS 문자열 길이(한글 한 자 = 1). 키 순서는 받은 객체 그대로 — 순서는 변환(convert.ts)이 정한다.
 *
 * 내보내기(빌드·스냅샷)와 서식 맞추기(npm run data:format)가 같은 함수를 써서 같은 글자를 만든다.
 */

/** prettier printWidth와 같다 */
export const WIDTH = 100;
const INDENT = '  ';

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function scalar(value: unknown): string {
	if (value === undefined || typeof value === 'function' || typeof value === 'symbol') {
		throw new Error(`JSON에 쓸 수 없는 값: ${String(value)}`);
	}
	if (typeof value === 'number' && !Number.isFinite(value)) {
		throw new Error(`JSON에 쓸 수 없는 숫자: ${value}`);
	}
	return JSON.stringify(value);
}

function inline(value: unknown): string {
	if (Array.isArray(value)) {
		return value.length === 0 ? '[]' : `[${value.map(inline).join(', ')}]`;
	}
	if (isObject(value)) {
		const keys = Object.keys(value);
		if (keys.length === 0) return '{}';
		return `{ ${keys.map((k) => `${JSON.stringify(k)}: ${inline(value[k])}`).join(', ')} }`;
	}
	return scalar(value);
}

/**
 * @param depth 이 값의 들여쓰기 깊이 (펼 때 닫는 괄호가 놓이는 깊이)
 * @param before 같은 줄에서 이 값 앞에 있는 글자 수 (들여쓰기 + 키)
 * @param after 같은 줄에서 이 값 뒤에 붙는 글자 수 (쉼표)
 */
function render(value: unknown, depth: number, before: number, after: number): string {
	const one = inline(value);
	if (!Array.isArray(value) && !isObject(value)) return one;
	if (before + one.length + after <= WIDTH) return one;

	const pad = INDENT.repeat(depth + 1);
	const close = INDENT.repeat(depth);
	if (Array.isArray(value)) {
		const lines = value.map(
			(item, i) => pad + render(item, depth + 1, pad.length, i < value.length - 1 ? 1 : 0)
		);
		return `[\n${lines.join(',\n')}\n${close}]`;
	}
	const keys = Object.keys(value);
	const lines = keys.map((k, i) => {
		const head = `${pad}${JSON.stringify(k)}: `;
		return head + render(value[k], depth + 1, head.length, i < keys.length - 1 ? 1 : 0);
	});
	return `{\n${lines.join(',\n')}\n${close}}`;
}

export function formatJson(value: unknown): string {
	return `${render(value, 0, 0, 0)}\n`;
}
