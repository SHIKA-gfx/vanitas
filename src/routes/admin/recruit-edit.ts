/**
 * 기간 편집 (docs/006 6-3, ④-2). 순수 함수 — 화면(RecruitEditor)과 테스트가 쓴다.
 *
 * - 편집 칸(RecruitDraft) ↔ 기간(RecruitPeriod, schedule.json recruits[] 모양)
 * - 저장 전 검사: validate.py check_recruits의 기간 규칙을 옮겼다. 최종 검사는 빌드의 validate.py
 * - 사이트 반영 상태: 이 화면을 연 배포에 들어 있는 기간과 DB의 기간을 비교한다
 *
 * id 규칙 (2026-11-10, docs/005 10-2): id = 시작일-이름. 날짜를 바꾸면 id도 바뀌고, 원래 id는 예전 id 끝에 남는다.
 * DB 함수 save_recruit도 같은 규칙으로 맞춘다 — 화면은 저장 전에 결과를 미리 보여 주려고 같은 계산을 한다.
 */
import type { RecruitBanner, RecruitPeriod } from '$lib/data/types';

/** id 뒷부분 (DB recruits.id 검사와 같은 규칙) */
export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const ID_RE = /^\d{4}-\d{2}-\d{2}-[a-z0-9]+(-[a-z0-9]+)*$/;

export interface RecruitDraft {
	start: string;
	end: string;
	/** id의 날짜 뒷부분 (예: fes-5-5th) */
	slug: string;
	status: RecruitPeriod['status'];
	event: string;
	/** 0이면 무료 모집 없음 */
	freePulls: number;
	note: string;
	previousIds: string[];
	banners: RecruitBanner[];
	offPickup: string[];
	sources: string[];
}

export function isDate(value: string): boolean {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	const d = new Date(`${value}T00:00:00Z`);
	return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function addDays(date: string, days: number): string {
	const d = new Date(`${date}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + days);
	return d.toISOString().slice(0, 10);
}

/** 한국 날짜 'YYYY-MM-DD' (일정 확인일) */
export function todayKst(now = new Date()): string {
	return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(now);
}

export function slugOf(id: string): string {
	return id.slice(11);
}

export function draftId(d: Pick<RecruitDraft, 'start' | 'slug'>): string {
	return `${d.start}-${d.slug}`;
}

export function draftFrom(r: RecruitPeriod): RecruitDraft {
	return {
		start: r.start,
		end: r.end,
		slug: slugOf(r.id),
		status: r.status,
		event: r.event ?? '',
		freePulls: r.freePulls ?? 0,
		note: r.note ?? '',
		previousIds: [...(r.previousIds ?? [])],
		banners: r.banners.map((b) => ({ type: b.type, students: [...b.students] })),
		offPickup: [...(r.offPickup ?? [])],
		sources: [...r.sources]
	};
}

/** 새 기간: 마지막 기간이 끝나는 날부터 7일, 추정, 픽업 모집 배너 하나 */
export function emptyDraft(recruits: readonly RecruitPeriod[], today: string): RecruitDraft {
	const last = recruits.reduce<string | null>(
		(m, r) => (m === null || r.end > m ? r.end : m),
		null
	);
	const start = last ?? today;
	return {
		start,
		end: addDays(start, 7),
		slug: '',
		status: 'estimated',
		event: '',
		freePulls: 0,
		note: '',
		previousIds: [],
		banners: [{ type: 'pickup_normal', students: [] }],
		offPickup: [],
		sources: []
	};
}

/**
 * 저장할 기간. 키 순서·빈 칸 빼기는 schedule.json과 같다 (convert.ts).
 * 고치는 기간의 id가 바뀌면 원래 id를 예전 id 끝에 더하고, 새 id는 예전 id에서 뺀다 (DB 함수와 같은 규칙)
 */
export function draftToRecruit(d: RecruitDraft, originalId: string | null): RecruitPeriod {
	const id = draftId(d);
	const previousIds = d.previousIds.filter((x) => x !== id);
	if (originalId !== null && originalId !== id && !previousIds.includes(originalId)) {
		previousIds.push(originalId);
	}
	const r: Record<string, unknown> = { id, start: d.start, end: d.end, status: d.status };
	if (d.event.trim()) r.event = d.event.trim();
	if (d.freePulls > 0) r.freePulls = d.freePulls;
	if (previousIds.length > 0) r.previousIds = previousIds;
	r.banners = d.banners.map((b) => ({ type: b.type, students: [...b.students] }));
	if (d.offPickup.length > 0) r.offPickup = [...d.offPickup];
	r.sources = [...d.sources];
	if (d.note.trim()) r.note = d.note.trim();
	return r as unknown as RecruitPeriod;
}

/** 원래 기간을 빼고 새 기간을 넣은 목록 (시작일, id 순 — 파일 순서와 같다) */
export function applyRecruit(
	all: readonly RecruitPeriod[],
	originalId: string | null,
	recruit: RecruitPeriod | null
): RecruitPeriod[] {
	const rest = all.filter((r) => r.id !== originalId);
	const list = recruit ? [...rest, recruit] : rest;
	return list.sort((a, b) =>
		a.start === b.start ? (a.id < b.id ? -1 : 1) : a.start < b.start ? -1 : 1
	);
}

// ------------------------------------------------------------ 저장 전 검사

export interface ValidationContext {
	studentIds: ReadonlySet<string>;
	/** 출처 id → 등급 (official | press | community) */
	sourceTier: ReadonlyMap<string, string>;
	/** 배너 종류 id → 한국 서버 운영 여부 */
	bannerAvailable: ReadonlyMap<string, boolean>;
	/** 모집 스택 전환일 (game-config pitySystem.schedule의 charge). 이전 기간은 두지 않는다 */
	firstStack: string;
}

export interface Issue {
	/** 어느 기간의 문제인가 */
	id: string;
	level: 'error' | 'warning';
	message: string;
}

/** validate.py check_recruits의 기간 규칙. 목록 전체를 본다 (예전 id·추정 뒤 공지는 기간 사이의 규칙) */
export function validateRecruits(rows: readonly RecruitPeriod[], ctx: ValidationContext): Issue[] {
	const issues: Issue[] = [];
	const err = (id: string, message: string) => issues.push({ id, level: 'error', message });
	const warn = (id: string, message: string) => issues.push({ id, level: 'warning', message });

	const seen = new Set<string>();
	const previousOwner = new Map<string, string>();
	for (const r of rows) {
		if (seen.has(r.id)) err(r.id, 'id가 다른 기간과 같아요');
		seen.add(r.id);
		if (!ID_RE.test(r.id)) err(r.id, 'id 뒷부분(이름)은 영어 소문자·숫자·하이픈(-)으로 적어요');
		if (!isDate(r.start) || !isDate(r.end)) {
			err(r.id, '날짜 형식이 맞지 않아요');
			continue;
		}
		if (!r.id.startsWith(r.start)) err(r.id, `id는 시작일(${r.start})로 시작해야 해요`);
		if (r.end <= r.start) err(r.id, '종료일은 시작일보다 늦어야 해요');
		if (r.start < ctx.firstStack) {
			err(r.id, `모집 스택 전환(${ctx.firstStack}) 이전 기간은 두지 않아요`);
		}

		const tiers = r.sources.map((s) => ctx.sourceTier.get(s));
		if (tiers.includes(undefined)) err(r.id, '없는 출처가 있어요');
		if (r.status === 'announced' && !tiers.includes('official')) {
			err(r.id, '공지된 기간에는 공식 출처가 하나 있어야 해요');
		} else if (r.status === 'estimated') {
			if (r.sources.length === 0) err(r.id, '추정 기간에도 출처가 있어야 해요');
			else if (r.sources.length < 2) warn(r.id, '출처가 하나뿐인 추정 기간이에요 (교차 확인 전)');
		}

		if (r.banners.length === 0) err(r.id, '배너가 없어요');
		r.banners.forEach((b, i) => {
			const available = ctx.bannerAvailable.get(b.type);
			if (available === undefined) err(r.id, `배너 ${i + 1}: 없는 배너 종류 '${b.type}'`);
			else if (!available) err(r.id, `배너 ${i + 1}: 한국 서버에서 운영하지 않는 배너 종류예요`);
			if (b.students.length === 0) err(r.id, `배너 ${i + 1}: 픽업 학생이 없어요`);
			for (const s of b.students) {
				if (!ctx.studentIds.has(s)) err(r.id, `배너 ${i + 1}: 없는 학생 '${s}'`);
			}
		});
		const picked = new Set(r.banners.flatMap((b) => b.students));
		for (const s of r.offPickup ?? []) {
			if (!ctx.studentIds.has(s)) err(r.id, `픽업 외: 없는 학생 '${s}'`);
			if (picked.has(s)) err(r.id, `'${s}'가 픽업 학생과 픽업 외 학생에 함께 있어요`);
		}
		if (r.freePulls !== undefined && !(Number.isInteger(r.freePulls) && r.freePulls > 0)) {
			err(r.id, '무료 모집은 1 이상의 정수예요');
		}

		for (const old of r.previousIds ?? []) {
			if (!ID_RE.test(old)) err(r.id, `예전 id '${old}'의 형식이 맞지 않아요`);
			else if (old === r.id) err(r.id, '예전 id에 지금 id가 있어요');
			else if (previousOwner.has(old)) {
				err(r.id, `예전 id '${old}'를 ${previousOwner.get(old)}도 갖고 있어요`);
			} else previousOwner.set(old, r.id);
		}
	}
	for (const [old, owner] of previousOwner) {
		if (seen.has(old)) err(owner, `예전 id '${old}'가 지금 있는 기간 id와 같아요`);
	}
	// 공지 뒤에 추정이 오는 것은 괜찮지만, 추정 뒤에 공지가 오면 순서가 틀린 것
	let seenEstimated = false;
	for (const r of rows) {
		if (r.status === 'estimated') seenEstimated = true;
		else if (seenEstimated) err(r.id, '추정 기간보다 뒤에 공지된 기간이 있어요');
	}
	return issues;
}

// ------------------------------------------------------------ 사이트 반영 상태

export type SyncState = 'same' | 'changed' | 'new';

export interface SiteSync {
	/** DB의 기간 id → 사이트와 같은가 */
	byId: Map<string, SyncState>;
	/** 사이트에는 있고 DB에는 없는 기간 (지운 기간) */
	removed: string[];
}

function canonical(value: unknown): string {
	const sort = (v: unknown): unknown => {
		if (Array.isArray(v)) return v.map(sort);
		if (v && typeof v === 'object') {
			const o = v as Record<string, unknown>;
			return Object.fromEntries(
				Object.keys(o)
					.sort()
					.map((k) => [k, sort(o[k])])
			);
		}
		return v;
	};
	return JSON.stringify(sort(value));
}

/** 이 화면을 연 배포(사이트)에 들어 있는 기간과 DB의 기간을 비교한다. 키 순서는 보지 않는다 */
export function compareWithSite(
	db: readonly RecruitPeriod[],
	site: readonly RecruitPeriod[]
): SiteSync {
	const siteById = new Map(site.map((r) => [r.id, canonical(r)]));
	const dbIds = new Set(db.map((r) => r.id));
	return {
		byId: new Map(
			db.map((r) => {
				const s = siteById.get(r.id);
				return [r.id, s === undefined ? 'new' : s === canonical(r) ? 'same' : 'changed'];
			})
		),
		removed: site.map((r) => r.id).filter((id) => !dbIds.has(id))
	};
}
