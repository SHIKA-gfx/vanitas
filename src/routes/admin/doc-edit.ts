/**
 * 데이터 문서 편집 (docs/006 6-3-3, ④-4). 순수 함수 — 편집 화면(ValueEditor 등)과 테스트가 쓴다.
 *
 * 편집 화면은 문서의 **값만** 고친다. 칸을 더하거나 빼는 모양 바꾸기는 "JSON 원문"으로 한다.
 * 그래서 키 순서는 처음 그대로 남는다 (편집은 같은 객체의 값을 바꾼다).
 */

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type JsonObject = { [key: string]: Json };

export function isPrimitive(v: unknown): v is null | boolean | number | string {
	return v === null || ['boolean', 'number', 'string'].includes(typeof v);
}

export function isObject(v: unknown): v is JsonObject {
	return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** {"$table": …} 자리 표시 — 정식 표로 뺀 칸 */
export function isPlaceholder(v: unknown): boolean {
	return isObject(v) && Object.keys(v).length === 1 && typeof v.$table === 'string';
}

/**
 * 표로 보여 줄 수 있는 목록이면 열 이름(처음 나온 순서)을, 아니면 null.
 * 모든 줄이 객체이고, 값이 원시값이거나 원시값 목록일 때 — 레이드 일정·레벨 표 같은 것
 */
export function tableColumns(rows: readonly unknown[]): string[] | null {
	if (rows.length === 0) return null;
	const cols: string[] = [];
	for (const row of rows) {
		if (!isObject(row)) return null;
		for (const [k, v] of Object.entries(row)) {
			const flat = isPrimitive(v) || (Array.isArray(v) && v.every(isPrimitive));
			if (!flat) return null;
			if (!cols.includes(k)) cols.push(k);
		}
	}
	return cols;
}

/** 열에 숫자가 있으면 빈칸(null)에 적은 숫자를 숫자로 읽는다 */
export function columnIsNumeric(rows: readonly unknown[], col: string): boolean {
	return rows.some((r) => isObject(r) && typeof r[col] === 'number');
}

/** 한 줄 더하기: 마지막 줄을 그대로 복사 (모양이 같은 줄이 생긴다 — 값을 고쳐 쓴다) */
export function copyOf<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * 원시값 칸에 적은 글자 → 값. 처음 값의 형을 지킨다
 * - 숫자 칸: 숫자로 읽히지 않으면 undefined (화면이 오류로 보인다)
 * - 빈칸(null) 칸: 비우면 null, numericHint면 숫자로 읽히는 글자는 숫자, 아니면 글자
 */
export function readPrimitive(
	text: string,
	original: null | number | string,
	numericHint = false
): Json | undefined {
	if (typeof original === 'number') {
		const t = text.trim();
		if (t === '' || !Number.isFinite(Number(t))) return undefined;
		return Number(t);
	}
	if (original === null) {
		if (text.trim() === '') return null;
		if (numericHint && Number.isFinite(Number(text.trim()))) return Number(text.trim());
		return text;
	}
	return text;
}

/** 원시값 목록 ↔ 쉼표 글자 (표의 칸). 처음 목록이 숫자면 숫자로 */
export function listToText(list: readonly unknown[]): string {
	return list.map((v) => (v === null ? '' : String(v))).join(', ');
}
export function textToList(text: string, numeric: boolean): Json[] | undefined {
	const parts = text
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);
	if (!numeric) return parts;
	const nums = parts.map(Number);
	return nums.every(Number.isFinite) ? nums : undefined;
}

// ------------------------------------------------------------ 바뀐 곳

function pathOf(base: string, key: string | number): string {
	return typeof key === 'number' ? `${base}[${key}]` : base ? `${base}.${key}` : key;
}

/** 바뀐 값이 있는 곳 (잎 단위). 줄이 늘거나 줄면 그 목록 자리 하나로 */
export function changedPaths(before: unknown, after: unknown, base = ''): string[] {
	if (isPrimitive(before) || isPrimitive(after)) {
		return before === after ? [] : [base || '(문서)'];
	}
	if (Array.isArray(before) && Array.isArray(after)) {
		const out: string[] = [];
		const n = Math.min(before.length, after.length);
		for (let i = 0; i < n; i++) out.push(...changedPaths(before[i], after[i], pathOf(base, i)));
		if (before.length !== after.length) {
			out.push(`${base} (${before.length}줄 → ${after.length}줄)`);
		}
		return out;
	}
	if (isObject(before) && isObject(after)) {
		const out: string[] = [];
		const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
		for (const k of keys) {
			if (!(k in after)) out.push(`${pathOf(base, k)} (지움)`);
			else if (!(k in before)) out.push(`${pathOf(base, k)} (새 칸)`);
			else out.push(...changedPaths(before[k], after[k], pathOf(base, k)));
		}
		return out;
	}
	return [base || '(문서)'];
}

function kind(v: unknown): string {
	if (v === null) return 'null';
	if (Array.isArray(v)) return '목록';
	return (
		{ number: '숫자', string: '글자', boolean: '참/거짓', object: '묶음' }[typeof v as string] ??
		typeof v
	);
}

/** 형이 바뀐 곳 (숫자 → 글자 등). null ↔ 다른 형은 빼고 — 빈칸을 채우거나 비우는 것은 흔하다 */
export function typeChanges(before: unknown, after: unknown, base = ''): string[] {
	if (before === null || after === null) return [];
	const a = kind(before);
	const b = kind(after);
	if (a !== b) return [`${base || '(문서)'}: ${a} → ${b}`];
	if (Array.isArray(before) && Array.isArray(after)) {
		const out: string[] = [];
		for (let i = 0; i < Math.min(before.length, after.length); i++) {
			out.push(...typeChanges(before[i], after[i], pathOf(base, i)));
		}
		return out;
	}
	if (isObject(before) && isObject(after)) {
		return Object.keys(before)
			.filter((k) => k in after)
			.flatMap((k) => typeChanges(before[k], after[k], pathOf(base, k)));
	}
	return [];
}

/** JSON 글자 읽기 — 틀리면 줄·칸을 알려 준다 */
export function parseJsonText(
	text: string
): { ok: true; value: JsonObject } | { ok: false; message: string } {
	try {
		const value = JSON.parse(text) as unknown;
		if (!isObject(value)) return { ok: false, message: '문서는 { … } 로 된 묶음이어야 해요' };
		return { ok: true, value };
	} catch (e) {
		const message = (e as Error).message;
		const at = /position (\d+)/.exec(message);
		if (at) {
			const pos = Number(at[1]);
			const before = text.slice(0, pos).split('\n');
			return {
				ok: false,
				message: `JSON 문법 오류 — ${before.length}번째 줄 ${before.at(-1)!.length + 1}번째 글자 근처`
			};
		}
		return { ok: false, message: `JSON 문법 오류: ${message}` };
	}
}
