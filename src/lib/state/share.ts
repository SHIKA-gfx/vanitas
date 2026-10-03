// 공유 링크 — 입력값 ↔ 주소 쿼리 (순수 함수).
// 링크에는 결과가 아니라 입력값을 담는다. 데이터가 갱신되면 같은 링크도 그 시점의 데이터로 다시 계산된다.
// 기본값과 같은 칸은 담지 않아 주소를 짧게 한다. 링크를 열 때는 기본값 위에 링크의 값을 얹는다.
//
// 칸 종류
//   int      정수            lv=60
//   str      문자열          m=date
//   list     문자열 목록      off=daily-mission,weekly-mission   (빈 목록은 off=)
//   map-int  키 → 정수        cf=8.4500,9.5000
//   map-str  키 → 문자열      sub=monthly-pass.2,half-pass.continuous

export type ShareKind = 'int' | 'str' | 'list' | 'map-int' | 'map-str';

export interface ShareField<K extends string = string> {
	/** 입력값 객체의 칸 이름 */
	key: K;
	/** 주소에 쓰는 짧은 이름 */
	param: string;
	kind: ShareKind;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function encodeValue(kind: ShareKind, value: unknown): string {
	switch (kind) {
		case 'int':
		case 'str':
			return String(value);
		case 'list':
			return (value as string[]).join(',');
		case 'map-int':
		case 'map-str':
			return Object.entries(value as Record<string, unknown>)
				.map(([k, v]) => `${k}.${v}`)
				.join(',');
	}
}

function decodeValue(kind: ShareKind, raw: string): unknown {
	switch (kind) {
		case 'int':
			return /^-?\d+$/.test(raw) ? Number(raw) : undefined;
		case 'str':
			return raw;
		case 'list':
			return raw === '' ? [] : raw.split(',');
		case 'map-int':
		case 'map-str': {
			if (raw === '') return {};
			const out: Record<string, unknown> = {};
			for (const pair of raw.split(',')) {
				const dot = pair.lastIndexOf('.');
				if (dot <= 0) return undefined;
				const v = pair.slice(dot + 1);
				if (kind === 'map-int' && !/^-?\d+$/.test(v)) return undefined;
				out[pair.slice(0, dot)] = kind === 'map-int' ? Number(v) : v;
			}
			return out;
		}
	}
}

/** 기본값과 다른 칸만 쿼리에 담는다 */
export function encodeShare(
	values: object,
	defaults: object,
	fields: readonly ShareField[],
	into = new URLSearchParams()
): URLSearchParams {
	const v = values as Record<string, unknown>;
	const d = defaults as Record<string, unknown>;
	for (const f of fields) {
		if (!same(v[f.key], d[f.key])) into.set(f.param, encodeValue(f.kind, v[f.key]));
	}
	return into;
}

/**
 * 쿼리에서 칸을 읽는다. 읽을 수 없는 값은 건너뛴다 (값의 범위 검사는 sanitize가 한다).
 * found: 이 칸들 중 하나라도 주소에 있었는가 → 공유 링크로 열었는가
 */
export function decodeShare(
	params: URLSearchParams,
	fields: readonly ShareField[]
): { values: Record<string, unknown>; found: boolean } {
	const values: Record<string, unknown> = {};
	let found = false;
	for (const f of fields) {
		if (!params.has(f.param)) continue;
		found = true;
		const v = decodeValue(f.kind, params.get(f.param) ?? '');
		if (v !== undefined) values[f.key] = v;
	}
	return { values, found };
}

/**
 * 여러 묶음(계산기 입력 + 공유 값)을 하나의 쿼리 문자열로. 담을 게 없으면 빈 문자열.
 * (URLSearchParams를 일반 .ts에서 만든다 — .svelte.ts에서는 반응형 판을 쓰라는 린트 규칙에 걸린다)
 */
export function shareQuery(
	parts: [values: object, defaults: object, fields: readonly ShareField[]][]
): string {
	const params = new URLSearchParams();
	for (const [values, defaults, fields] of parts) encodeShare(values, defaults, fields, params);
	return params.toString();
}
