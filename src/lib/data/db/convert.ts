/**
 * 데이터 파일 ↔ DB 행 변환 (docs/006 4-4, 7-1). 순수 함수 — 통신·파일 읽기는 scripts/가 한다.
 *
 * - filesToRows: data/*.json → 표 9개의 행 (넣기 SQL이 쓴다)
 * - rowsToFiles: 표 9개의 행 → data/*.json (빌드의 내보내기가 쓴다)
 *
 * 정식 표로 옮긴 것(출처·학생·픽업 기간)에 표에 없는 칸이 있으면 오류로 멈춘다.
 * 조용히 버리면 새 칸(예: 11/10의 previousIds)이 DB를 한 번 거치며 사라진다 — 열을 더하고 여기를 고친다.
 */
import type { RecruitBanner, RecruitPeriod, Student } from '../types.ts';
import type {
	BannerStudentRow,
	DatasetRow,
	GameDataRows,
	RecruitBannerRow,
	RecruitOffPickupRow,
	RecruitPreviousIdRow,
	RecruitRow,
	RecruitSourceRow,
	SourceRow,
	StudentRow
} from './rows.ts';
import { TABLED_KEYS } from './rows.ts';

/** data/ 기준 경로(예: 'ko/schedule.json') → 파싱한 JSON */
export type DataFiles = Record<string, Record<string, unknown>>;

/** sources.json의 출처 한 건 */
export interface SourceEntry {
	publisher: string;
	title: string;
	date: string | null;
	url: string | null;
	retrievedAt?: string;
	tier: string;
	note?: string;
}

/** 파일에 쓰는 키 순서 (docs/006 4-4). 빈 값은 키를 빼는 칸이 있다 */
const RECRUIT_KEYS = [
	'id',
	'start',
	'end',
	'status',
	'event',
	'freePulls',
	'previousIds',
	'banners',
	'offPickup',
	'sources',
	'note'
] as const;
const BANNER_KEYS = ['type', 'students'] as const;
const STUDENT_KEYS = ['id', 'gameId', 'name', 'koNameStatus'] as const;
const NAME_KEYS = ['ko', 'ja'] as const;
const SOURCE_KEYS = ['publisher', 'title', 'date', 'url', 'retrievedAt', 'tier', 'note'] as const;

/** 표로 뺀 배열 자리에 두는 표시 */
export function placeholder(table: string): { $table: string } {
	return { $table: table };
}

function isPlaceholder(value: unknown, table: string): boolean {
	return (
		typeof value === 'object' &&
		value !== null &&
		!Array.isArray(value) &&
		Object.keys(value).length === 1 &&
		(value as { $table?: unknown }).$table === table
	);
}

function fail(message: string): never {
	throw new Error(`데이터 변환: ${message}`);
}

function checkKeys(where: string, obj: object, allowed: readonly string[]): void {
	for (const key of Object.keys(obj)) {
		if (!allowed.includes(key)) {
			fail(`${where}에 표에 없는 칸 '${key}' — DB에 열을 더하고 변환을 고친다 (docs/006 4-4)`);
		}
	}
}

function need<T>(where: string, value: T | undefined): T {
	if (value === undefined) fail(`${where}이(가) 없다`);
	return value;
}

const bySeq = (a: { seq: number }, b: { seq: number }) => a.seq - b.seq;
const compareText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

function groupBy<T>(rows: readonly T[], key: (row: T) => string): Map<string, T[]> {
	const map = new Map<string, T[]>();
	for (const row of rows) {
		const k = key(row);
		const list = map.get(k);
		if (list) list.push(row);
		else map.set(k, [row]);
	}
	return map;
}

// ------------------------------------------------------------ 출처

export function sourcesToRows(sources: Record<string, SourceEntry>): SourceRow[] {
	return Object.entries(sources).map(([id, s]) => {
		const where = `출처 ${id}`;
		checkKeys(where, s, SOURCE_KEYS);
		return {
			id,
			publisher: need(`${where} publisher`, s.publisher),
			title: need(`${where} title`, s.title),
			published: s.date ?? null,
			url: s.url ?? null,
			retrieved_at: s.retrievedAt ?? null,
			tier: need(`${where} tier`, s.tier),
			note: s.note ?? null
		};
	});
}

export function rowsToSources(rows: readonly SourceRow[]): Record<string, SourceEntry> {
	const sorted = [...rows].sort((a, b) => Number(a.id) - Number(b.id));
	const out: Record<string, SourceEntry> = {};
	for (const r of sorted) {
		// 키 순서는 SOURCE_KEYS. date·url은 null이어도 쓰고, retrievedAt·note는 null이면 뺀다
		const entry: Record<string, unknown> = {
			publisher: r.publisher,
			title: r.title,
			date: r.published,
			url: r.url
		};
		if (r.retrieved_at !== null) entry.retrievedAt = r.retrieved_at;
		entry.tier = r.tier;
		if (r.note !== null) entry.note = r.note;
		out[r.id] = entry as unknown as SourceEntry;
	}
	return out;
}

// ------------------------------------------------------------ 학생

export function studentsToRows(students: readonly Student[]): StudentRow[] {
	return students.map((s, i) => {
		const where = `학생 ${s.id ?? i + 1}`;
		checkKeys(where, s, STUDENT_KEYS);
		const name = need(`${where} name`, s.name);
		checkKeys(`${where} name`, name, NAME_KEYS);
		return {
			id: need(`${where} id`, s.id),
			game_id: need(`${where} gameId`, s.gameId),
			name_ko: need(`${where} name.ko`, name.ko),
			name_ja: name.ja ?? null,
			ko_name_status: need(`${where} koNameStatus`, s.koNameStatus),
			seq: i + 1
		};
	});
}

export function rowsToStudents(rows: readonly StudentRow[]): Student[] {
	return [...rows].sort(bySeq).map((r) => ({
		id: r.id,
		gameId: r.game_id,
		name: { ko: r.name_ko, ja: r.name_ja },
		koNameStatus: r.ko_name_status as Student['koNameStatus']
	}));
}

// ------------------------------------------------------------ 픽업 기간

/** 기간 하나를 표 6개의 행으로. 관리자 화면의 저장도 같은 모양을 쓴다 (④) */
export interface RecruitRows {
	recruit: RecruitRow;
	previousIds: RecruitPreviousIdRow[];
	banners: RecruitBannerRow[];
	bannerStudents: BannerStudentRow[];
	offPickup: RecruitOffPickupRow[];
	sources: RecruitSourceRow[];
}

export function recruitToRows(r: RecruitPeriod): RecruitRows {
	const where = `기간 ${r.id ?? '(id 없음)'}`;
	checkKeys(where, r, RECRUIT_KEYS);
	const id = need(`${where} id`, r.id);
	const banners = need(`${where} banners`, r.banners);
	const bannerStudents: BannerStudentRow[] = [];
	banners.forEach((b, i) => {
		checkKeys(`${where} 배너 ${i + 1}`, b, BANNER_KEYS);
		need(`${where} 배너 ${i + 1} students`, b.students).forEach((sid, j) =>
			bannerStudents.push({ recruit_id: id, banner_seq: i + 1, seq: j + 1, student_id: sid })
		);
	});
	return {
		recruit: {
			id,
			start_date: need(`${where} start`, r.start),
			end_date: need(`${where} end`, r.end),
			status: need(`${where} status`, r.status),
			event: r.event ?? null,
			free_pulls: r.freePulls ?? null,
			note: r.note ?? null
		},
		previousIds: (r.previousIds ?? []).map((old, i) => ({ recruit_id: id, seq: i + 1, old_id: old })),
		banners: banners.map((b, i) => ({
			recruit_id: id,
			seq: i + 1,
			type: need(`${where} 배너 ${i + 1} type`, b.type)
		})),
		bannerStudents,
		offPickup: (r.offPickup ?? []).map((sid, i) => ({ recruit_id: id, seq: i + 1, student_id: sid })),
		sources: need(`${where} sources`, r.sources).map((sid, i) => ({
			recruit_id: id,
			seq: i + 1,
			source_id: sid
		}))
	};
}

type RecruitTables = Pick<
	GameDataRows,
	| 'recruits'
	| 'recruit_previous_ids'
	| 'recruit_banners'
	| 'banner_students'
	| 'recruit_off_pickup'
	| 'recruit_sources'
>;

export function recruitsToRows(recruits: readonly RecruitPeriod[]): RecruitTables {
	const out: RecruitTables = {
		recruits: [],
		recruit_previous_ids: [],
		recruit_banners: [],
		banner_students: [],
		recruit_off_pickup: [],
		recruit_sources: []
	};
	for (const r of recruits) {
		const rows = recruitToRows(r);
		out.recruits.push(rows.recruit);
		out.recruit_previous_ids.push(...rows.previousIds);
		out.recruit_banners.push(...rows.banners);
		out.banner_students.push(...rows.bannerStudents);
		out.recruit_off_pickup.push(...rows.offPickup);
		out.recruit_sources.push(...rows.sources);
	}
	return out;
}

/** 표 6개의 행 → 기간 목록. 순서는 시작일, id (docs/006 4-4) */
export function rowsToRecruits(rows: RecruitTables): RecruitPeriod[] {
	// 없는 기간을 가리키는 행은 DB 참조 제약이 막지만, 손으로 만든 행을 받을 때를 위해 한 번 더 본다
	const ids = new Set(rows.recruits.map((r) => r.id));
	const checked = <T extends { recruit_id: string }>(table: string, list: readonly T[]) => {
		for (const row of list) {
			if (!ids.has(row.recruit_id)) fail(`${table}에 없는 기간 ${row.recruit_id}`);
		}
		return list;
	};
	const byRecruit = <T extends { recruit_id: string }>(table: string, list: readonly T[]) =>
		groupBy(checked(table, list), (row) => row.recruit_id);
	const previous = byRecruit('recruit_previous_ids', rows.recruit_previous_ids);
	const banners = byRecruit('recruit_banners', rows.recruit_banners);
	const bannerStudents = groupBy(checked('banner_students', rows.banner_students), bannerKey);
	const offPickup = byRecruit('recruit_off_pickup', rows.recruit_off_pickup);
	const sources = byRecruit('recruit_sources', rows.recruit_sources);

	const sorted = [...rows.recruits].sort(
		(a, b) => compareText(a.start_date, b.start_date) || compareText(a.id, b.id)
	);
	return sorted.map((r) => {
		const out: Record<string, unknown> = { id: r.id, start: r.start_date, end: r.end_date, status: r.status };
		if (r.event !== null) out.event = r.event;
		if (r.free_pulls !== null) out.freePulls = r.free_pulls;
		const prev = (previous.get(r.id) ?? []).sort(bySeq).map((p) => p.old_id);
		if (prev.length > 0) out.previousIds = prev;
		out.banners = (banners.get(r.id) ?? []).sort(bySeq).map(
			(b): RecruitBanner => ({
				type: b.type,
				students: (bannerStudents.get(bannerKey({ recruit_id: r.id, banner_seq: b.seq })) ?? [])
					.sort(bySeq)
					.map((s) => s.student_id)
			})
		);
		const off = (offPickup.get(r.id) ?? []).sort(bySeq).map((o) => o.student_id);
		if (off.length > 0) out.offPickup = off;
		out.sources = (sources.get(r.id) ?? []).sort(bySeq).map((s) => s.source_id);
		if (r.note !== null) out.note = r.note;
		return out as unknown as RecruitPeriod;
	});
}

function bannerKey(row: { recruit_id: string; banner_seq: number }): string {
	return `${row.recruit_id}#${row.banner_seq}`;
}

// ------------------------------------------------------------ 파일 전체

/** data/*.json 전부 → 표 9개의 행. 표로 뺀 배열 자리에는 자리 표시를 둔다 (키 순서가 남는다) */
export function filesToRows(files: DataFiles): GameDataRows {
	const datasets: DatasetRow[] = [];
	let sources: SourceRow[] | null = null;
	let students: StudentRow[] | null = null;
	let recruits: RecruitTables | null = null;

	for (const path of Object.keys(files).sort()) {
		const doc = { ...files[path] };
		const tabled = TABLED_KEYS[path];
		if (tabled) {
			const value = doc[tabled.key];
			if (value === undefined) fail(`${path}에 ${tabled.key}가 없다`);
			if (tabled.table === 'sources') sources = sourcesToRows(value as Record<string, SourceEntry>);
			else if (tabled.table === 'students') students = studentsToRows(value as Student[]);
			else recruits = recruitsToRows(value as RecruitPeriod[]);
			doc[tabled.key] = placeholder(tabled.table); // 같은 키에 다시 넣으므로 순서가 그대로다
		}
		datasets.push({ path, data: doc });
	}
	for (const [path, { table }] of Object.entries(TABLED_KEYS)) {
		if (!(path in files)) fail(`${path}가 없다 (${table} 표의 원본)`);
	}
	return {
		sources: sources ?? [],
		students: students ?? [],
		...(recruits as RecruitTables),
		datasets
	};
}

/** 표 9개의 행 → data/*.json 전부. 자리 표시를 표 내용으로 채운다 */
export function rowsToFiles(rows: GameDataRows): DataFiles {
	const filled: Record<string, unknown> = {
		sources: rowsToSources(rows.sources),
		students: rowsToStudents(rows.students),
		recruits: rowsToRecruits(rows)
	};
	const files: DataFiles = {};
	for (const { path, data } of [...rows.datasets].sort((a, b) => compareText(a.path, b.path))) {
		if (path in files) fail(`datasets에 ${path}가 두 번 있다`);
		const doc = { ...data };
		const tabled = TABLED_KEYS[path];
		if (tabled) {
			if (!isPlaceholder(doc[tabled.key], tabled.table)) {
				fail(`${path}의 ${tabled.key} 자리에 {"$table": "${tabled.table}"} 표시가 없다`);
			}
			doc[tabled.key] = filled[tabled.table];
		}
		files[path] = doc;
	}
	for (const path of Object.keys(TABLED_KEYS)) {
		if (!(path in files)) fail(`datasets에 ${path}가 없다`);
	}
	return files;
}
