// 브라우저 저장 (localStorage) — 순수 함수 부분.
// 저장소 접근과 화면 연결은 saved.svelte.ts가 한다. 여기는 테스트하기 쉬운 계산만 둔다.
//
// 저장 형식: 키 하나("vanitas:v1")에 { version, sections: { user, pity, levelup, income } }
// - version: 저장 형식이 바뀌면 올리고, 옛 형식은 migrate에서 새 형식으로 옮긴다
// - 불러올 때는 칸마다 검사해서, 맞지 않는 칸만 기본값으로 돌린다 (하나가 틀렸다고 전체를 버리지 않는다)

export const STORAGE_KEY = 'vanitas:v1';
export const SAVE_VERSION = 1;

export interface SaveFile {
	version: number;
	sections: Record<string, unknown>;
}

export const emptySaveFile = (): SaveFile => ({ version: SAVE_VERSION, sections: {} });

/** 저장소의 문자열을 읽는다. 없거나 깨졌거나 알 수 없는 판이면 빈 파일 */
export function parseSaveFile(raw: string | null): SaveFile {
	if (!raw) return emptySaveFile();
	try {
		const data = JSON.parse(raw) as Partial<SaveFile>;
		if (typeof data !== 'object' || data === null) return emptySaveFile();
		if (typeof data.sections !== 'object' || data.sections === null) return emptySaveFile();
		return migrate({ version: Number(data.version), sections: data.sections });
	} catch {
		return emptySaveFile();
	}
}

/** 옛 판을 지금 판으로. 판이 하나뿐인 지금은 같은 판만 통과시킨다 */
function migrate(file: SaveFile): SaveFile {
	if (file.version === SAVE_VERSION) return file;
	return emptySaveFile();
}

export function withSection(file: SaveFile, name: string, value: unknown): SaveFile {
	return { version: SAVE_VERSION, sections: { ...file.sections, [name]: value } };
}

// ---------------------------------------------------------------- 칸 검사

/** 값 하나가 받아들일 만한지 */
export type Check = (value: unknown) => boolean;

export const isInt =
	(min: number, max = Number.MAX_SAFE_INTEGER): Check =>
	(v) =>
		Number.isInteger(v) && (v as number) >= min && (v as number) <= max;

export const isOneOf =
	(values: readonly string[]): Check =>
	(v) =>
		typeof v === 'string' && values.includes(v);

/** 오늘보다 뒤의 'YYYY-MM-DD'. 지나간 날짜는 받지 않는다 (기본값으로 돌린다) */
export const isFutureDate =
	(today: string): Check =>
	(v) =>
		typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && v > today;

/** 문자열 배열이고, 모든 원소가 허용 목록 안에 있다 */
export const isSubsetOf =
	(values: readonly string[]): Check =>
	(v) =>
		Array.isArray(v) && v.every((x) => typeof x === 'string' && values.includes(x));

/** 객체이고, 모든 키가 허용 목록 안에 있으며 각 값이 검사를 통과한다 */
export const isRecordOf =
	(keys: readonly string[], item: (key: string, value: unknown) => boolean): Check =>
	(v) =>
		typeof v === 'object' &&
		v !== null &&
		!Array.isArray(v) &&
		Object.entries(v).every(([k, x]) => keys.includes(k) && item(k, x));

/**
 * 저장된 값을 기본값 모양에 맞춘다. 칸마다 검사해서 통과하면 저장값, 아니면 기본값.
 * 기본값에 없는 칸(옛 판의 남은 칸)은 버리고, 저장값에 없는 칸(새로 생긴 칸)은 기본값으로 채운다.
 */
export function sanitize<T extends Record<string, unknown>>(
	raw: unknown,
	defaults: T,
	checks: { [K in keyof T]: Check }
): T {
	const source = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
	const out = { ...defaults };
	for (const key of Object.keys(defaults) as (keyof T)[]) {
		const value = source[key as string];
		if (value !== undefined && checks[key](value)) out[key] = value as T[keyof T];
	}
	return out;
}
