/**
 * DB 행 모양 (supabase/migrations, docs/006 4장).
 * 열 이름은 DB 그대로(snake_case). Data API가 돌려주는 날짜는 'YYYY-MM-DD' 문자열이다.
 * DB가 더 돌려주는 열(updated_at 등)은 변환에서 쓰지 않는다.
 *
 * 이 폴더의 파일은 빌드 스크립트(scripts/*.ts)가 Node로 바로 실행하므로
 * 상대 경로 import에 확장자 .ts를 붙이고, 타입만 가져올 때는 import type을 쓴다 (Node 타입 지우기 규칙).
 */

export interface SourceRow {
	id: string;
	publisher: string;
	title: string;
	/** JSON date. 연도·연월만 있는 출처가 있어 text */
	published: string | null;
	url: string | null;
	retrieved_at: string | null;
	tier: string;
	note: string | null;
}

export interface StudentRow {
	id: string;
	game_id: number;
	name_ko: string;
	name_ja: string | null;
	ko_name_status: string;
	/** 파일에 쓰는 순서 (1부터) */
	seq: number;
}

export interface RecruitRow {
	id: string;
	start_date: string;
	end_date: string;
	status: string;
	event: string | null;
	free_pulls: number | null;
	note: string | null;
}

export interface RecruitPreviousIdRow {
	recruit_id: string;
	seq: number;
	old_id: string;
}

export interface RecruitBannerRow {
	recruit_id: string;
	seq: number;
	type: string;
}

export interface BannerStudentRow {
	recruit_id: string;
	banner_seq: number;
	seq: number;
	student_id: string;
}

export interface RecruitOffPickupRow {
	recruit_id: string;
	seq: number;
	student_id: string;
}

export interface RecruitSourceRow {
	recruit_id: string;
	seq: number;
	source_id: string;
}

/** 파일 하나 = 행 하나. 표로 뺀 배열 자리에는 {"$table": 표 이름} */
export interface DatasetRow {
	path: string;
	data: Record<string, unknown>;
}

/** 게임 데이터 표 9개의 행 전부. 키는 표 이름 */
export interface GameDataRows {
	sources: SourceRow[];
	students: StudentRow[];
	recruits: RecruitRow[];
	recruit_previous_ids: RecruitPreviousIdRow[];
	recruit_banners: RecruitBannerRow[];
	banner_students: BannerStudentRow[];
	recruit_off_pickup: RecruitOffPickupRow[];
	recruit_sources: RecruitSourceRow[];
	datasets: DatasetRow[];
}

export type TableName = keyof GameDataRows;

/** 넣는 순서 (참조되는 표가 먼저). 내보내기도 이 표들을 읽는다 */
export const TABLES: readonly TableName[] = [
	'sources',
	'students',
	'recruits',
	'recruit_previous_ids',
	'recruit_banners',
	'banner_students',
	'recruit_off_pickup',
	'recruit_sources',
	'datasets'
];

/** 표 열 이름 (넣기 SQL이 쓴다). DB가 채우는 열(updated_at)은 없다 */
export const COLUMNS: { readonly [T in TableName]: readonly (keyof GameDataRows[T][number])[] } = {
	sources: ['id', 'publisher', 'title', 'published', 'url', 'retrieved_at', 'tier', 'note'],
	students: ['id', 'game_id', 'name_ko', 'name_ja', 'ko_name_status', 'seq'],
	recruits: ['id', 'start_date', 'end_date', 'status', 'event', 'free_pulls', 'note'],
	recruit_previous_ids: ['recruit_id', 'seq', 'old_id'],
	recruit_banners: ['recruit_id', 'seq', 'type'],
	banner_students: ['recruit_id', 'banner_seq', 'seq', 'student_id'],
	recruit_off_pickup: ['recruit_id', 'seq', 'student_id'],
	recruit_sources: ['recruit_id', 'seq', 'source_id'],
	datasets: ['path', 'data']
};

/** 정식 표로 뺀 배열: 파일 → 그 파일의 키 → 표 (docs/006 4-5) */
export const TABLED_KEYS: Readonly<Record<string, { key: string; table: 'recruits' | 'students' | 'sources' }>> =
	{
		'ko/schedule.json': { key: 'recruits', table: 'recruits' },
		'ko/students.json': { key: 'students', table: 'students' },
		'sources.json': { key: 'sources', table: 'sources' }
	};
