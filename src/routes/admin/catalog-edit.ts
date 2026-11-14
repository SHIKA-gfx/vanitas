/**
 * 학생·출처 편집 (docs/006 6-3, ④-3). 순수 함수 — 화면(StudentEditor·SourceEditor)과 테스트가 쓴다.
 *
 * - 편집 칸 ↔ 데이터 파일 모양 (students.json students[] / sources.json sources의 한 건)
 * - 저장 전 검사: validate.py check_recruits의 학생 규칙(이름 괄호 등)과 DB 제약을 옮겼다. 최종 검사는 빌드의 validate.py
 * - 쓰임: 어느 기간이 이 학생·출처를 쓰는가 (지울 수 있는지, 목록 표시)
 *
 * 학생 id는 저장값·공유 링크(목표 이름 "기간 id~학생 id")가 쓰므로 만든 뒤 바꾸지 않는다.
 * 출처 id는 저장할 때 DB가 다음 번호로 정한다. 출처는 지우지 않는다 (예전 값의 근거로 남긴다).
 */
import type { SourceEntry } from '$lib/data/db/convert';
import type { RecruitPeriod, Student } from '$lib/data/types';
import { isDate } from './recruit-edit';

/** DB students.id 검사와 같은 규칙 */
export const STUDENT_ID_RE = /^[a-z][a-z0-9_]*$/;
/** DB sources.published 검사와 같은 규칙 — 연도·연월만 있는 출처가 있다 */
const SOURCE_DATE_RE = /^\d{4}(-\d{2}(-\d{2})?)?$/;
// DB sources.url 검사와 같은 규칙. 나무위키처럼 공백이 든 주소가 있어 공백은 막지 않는다
const URL_RE = /^https?:\/\/\S/;

export type Tier = 'official' | 'press' | 'community';
export const TIER_LABEL: Record<Tier, string> = {
	official: '공식',
	press: '언론',
	community: '커뮤니티'
};

/** 칸 하나의 문제. field가 있으면 그 칸 아래에 보인다 */
export interface FieldIssue {
	level: 'error' | 'warning';
	field?: string;
	message: string;
}

// ------------------------------------------------------------ 학생

export interface StudentDraft {
	id: string;
	gameId: number;
	ko: string;
	ja: string;
	status: Student['koNameStatus'];
}

export function studentDraftFrom(s: Student): StudentDraft {
	return { id: s.id, gameId: s.gameId, ko: s.name.ko, ja: s.name.ja ?? '', status: s.koNameStatus };
}

export function emptyStudentDraft(): StudentDraft {
	return { id: '', gameId: 0, ko: '', ja: '', status: 'provisional' };
}

/** students.json의 한 줄과 같은 모양·키 순서 */
export function draftToStudent(d: StudentDraft): Student {
	return {
		id: d.id.trim(),
		gameId: d.gameId,
		name: { ko: d.ko.trim(), ja: d.ja.trim() || null },
		koNameStatus: d.status
	};
}

/**
 * @param others 이 학생을 뺀 나머지 학생 (id·게임 번호 겹침을 본다)
 * @param isNew 새 학생이면 id 규칙·겹침을 본다 (고칠 때는 id를 바꾸지 않는다)
 */
export function validateStudent(
	d: StudentDraft,
	others: readonly Student[],
	isNew: boolean
): FieldIssue[] {
	const issues: FieldIssue[] = [];
	const err = (field: string, message: string) => issues.push({ level: 'error', field, message });
	const s = draftToStudent(d);
	if (isNew) {
		if (!STUDENT_ID_RE.test(s.id)) {
			err('id', '영어 소문자로 시작하고 소문자·숫자·밑줄(_)만 써요 (예: hoshino_armed)');
		} else if (others.some((o) => o.id === s.id)) err('id', '같은 id의 학생이 이미 있어요');
	}
	if (!Number.isInteger(s.gameId) || s.gameId <= 0) err('gameId', '게임 안 학생 번호를 적어요');
	else {
		const same = others.find((o) => o.gameId === s.gameId);
		if (same) err('gameId', `${same.name.ko}(${same.id})와 번호가 같아요`);
	}
	// 괄호 표기 (validate.py): 한국어는 반각 "이름(의상)", 일본어는 전각 "名前（衣装）", 앞에 공백 없이
	const ko = s.name.ko;
	const ja = s.name.ja ?? '';
	if (!ko) err('ko', '한국어 이름을 적어요');
	else if (/[（）]/.test(ko) || ko.includes(' (')) {
		err('ko', '한국어 이름은 반각 괄호, 앞 공백 없이: 이름(의상)');
	}
	if (/[()]/.test(ja) || ja.includes(' （'))
		err('ja', '일본어 이름은 전각 괄호, 앞 공백 없이: 名前（衣装）');
	for (const [field, name] of [
		['ko', ko],
		['ja', ja]
	] as const) {
		const open = (name.match(/[(（]/g) ?? []).length;
		const close = (name.match(/[)）]/g) ?? []).length;
		if (open !== close) err(field, '괄호 짝이 맞지 않아요');
	}
	if (s.koNameStatus === 'provisional' && !s.name.ja) {
		issues.push({
			level: 'warning',
			field: 'ja',
			message: '가칭 학생은 일본 공식 이름을 함께 보여 줘요 — 알면 적어요'
		});
	}
	return issues;
}

// ------------------------------------------------------------ 출처

export interface SourceDraft {
	publisher: string;
	title: string;
	/** YYYY / YYYY-MM / YYYY-MM-DD, 모르면 빈칸 */
	date: string;
	url: string;
	/** 확인한 날, 빈칸이면 키를 뺀다 */
	retrievedAt: string;
	tier: Tier;
	note: string;
}

export function sourceDraftFrom(s: SourceEntry): SourceDraft {
	return {
		publisher: s.publisher,
		title: s.title,
		date: s.date ?? '',
		url: s.url ?? '',
		retrievedAt: s.retrievedAt ?? '',
		tier: s.tier as Tier,
		note: s.note ?? ''
	};
}

export function emptySourceDraft(today: string): SourceDraft {
	return {
		publisher: '',
		title: '',
		date: '',
		url: '',
		retrievedAt: today,
		tier: 'official',
		note: ''
	};
}

/** sources.json의 한 건과 같은 모양·키 순서 (date·url은 null도 쓰고, retrievedAt·note는 빈칸이면 뺀다) */
export function draftToSource(d: SourceDraft): SourceEntry {
	const e: Record<string, unknown> = {
		publisher: d.publisher.trim(),
		title: d.title.trim(),
		date: d.date.trim() || null,
		url: d.url.trim() || null
	};
	if (d.retrievedAt.trim()) e.retrievedAt = d.retrievedAt.trim();
	e.tier = d.tier;
	if (d.note.trim()) e.note = d.note.trim();
	return e as unknown as SourceEntry;
}

export function validateSource(d: SourceDraft): FieldIssue[] {
	const issues: FieldIssue[] = [];
	const err = (field: string, message: string) => issues.push({ level: 'error', field, message });
	const s = draftToSource(d);
	if (!s.publisher) err('publisher', '발행처를 적어요 (예: 넥슨, 디스이즈게임)');
	if (!s.title) err('title', '제목을 적어요');
	if (s.date !== null) {
		const ok =
			SOURCE_DATE_RE.test(s.date) &&
			(s.date.length === 4 || isDate(s.date.length === 7 ? `${s.date}-01` : s.date));
		if (!ok) err('date', 'YYYY, YYYY-MM, YYYY-MM-DD 중 하나로 적어요');
	}
	if (s.url !== null && !URL_RE.test(s.url))
		err('url', 'http:// 또는 https://로 시작하는 주소를 적어요');
	if (s.retrievedAt !== undefined && !isDate(s.retrievedAt))
		err('retrievedAt', '날짜 형식이 맞지 않아요');
	if (!(s.tier in TIER_LABEL)) err('tier', '등급을 골라요');
	if (s.url === null) {
		issues.push({
			level: 'warning',
			field: 'url',
			message:
				'주소가 없으면 빌드 검사가 경고해요 (생방송처럼 주소가 없는 출처는 메모에 사정을 적어요)'
		});
	}
	return issues;
}

/** 다음 출처 번호 (저장할 때 DB가 같은 규칙으로 정한다 — 화면은 미리 보여 주기만) */
export function nextSourceId(ids: Iterable<string>): string {
	let max = 0;
	for (const id of ids) max = Math.max(max, Number(id) || 0);
	return String(max + 1);
}

// ------------------------------------------------------------ 쓰임

export interface Usage {
	/** 학생 id → 그 학생을 픽업·픽업 외로 쓰는 기간 id */
	students: Map<string, string[]>;
	/** 출처 id → 그 출처를 쓰는 기간 id */
	sources: Map<string, string[]>;
}

export function countUsage(recruits: readonly RecruitPeriod[]): Usage {
	const students = new Map<string, string[]>();
	const sources = new Map<string, string[]>();
	const add = (map: Map<string, string[]>, key: string, id: string) => {
		const list = map.get(key) ?? [];
		if (!list.includes(id)) list.push(id);
		map.set(key, list);
	};
	for (const r of recruits) {
		for (const b of r.banners) for (const s of b.students) add(students, s, r.id);
		for (const s of r.offPickup ?? []) add(students, s, r.id);
		for (const s of r.sources) add(sources, s, r.id);
	}
	return { students, sources };
}
