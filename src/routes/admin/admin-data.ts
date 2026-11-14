/**
 * 관리자 화면이 읽고 쓰는 것 (docs/006 6장). 통신은 얇게, 표시용 계산은 순수 함수로.
 * 표 → 기간 변환은 내보내기와 같은 함수(src/lib/data/db/convert.ts)를 쓴다 — 화면과 사이트가 같은 모양을 본다.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { BannerType, GameConfig, RecruitPeriod } from '$lib/data/types';
import type { GameDataRows } from '$lib/data/db/rows';
import { rowsToRecruits, rowsToStudents } from '$lib/data/db/convert';
import type { ValidationContext } from './recruit-edit';

const RECRUIT_TABLES = [
	'recruits',
	'recruit_previous_ids',
	'recruit_banners',
	'banner_students',
	'recruit_off_pickup',
	'recruit_sources'
] as const;

type RecruitTables = Pick<GameDataRows, (typeof RECRUIT_TABLES)[number]>;

function fail(what: string, error: { message: string } | null): never {
	throw new Error(`${what}: ${error?.message ?? '알 수 없는 오류'}`);
}

async function rows<T>(sb: SupabaseClient, table: string): Promise<T[]> {
	const { data, error } = await sb.from(table).select('*');
	if (error) fail(table, error);
	return (data ?? []) as T[];
}

/** 지금 로그인한 사람이 관리자인가 (DB 함수 is_admin, docs/006 5-1) */
export async function checkAdmin(sb: SupabaseClient): Promise<boolean> {
	const { data, error } = await sb.rpc('is_admin');
	if (error) fail('is_admin', error);
	return data === true;
}

export interface Choice {
	id: string;
	label: string;
}

export interface RecruitOverview {
	recruits: RecruitPeriod[];
	studentName: Map<string, string>;
	bannerName: Map<string, string>;
	/** 편집 화면의 선택지 (파일 순서) */
	students: Choice[];
	/** 한국 서버에서 운영하는 배너 종류 */
	bannerTypes: Choice[];
	/** "id · 발행처 · 제목", id 숫자 순 */
	sources: Choice[];
	/** 저장 전 검사 (recruit-edit.ts validateRecruits) */
	validation: ValidationContext;
}

const DOCS = ['ko/banner-types.json', 'ko/game-config.json'] as const;

/** 미래시 기간 전부 + 이름표 + 편집 선택지 + 검사에 쓰는 값 */
export async function loadRecruits(sb: SupabaseClient): Promise<RecruitOverview> {
	const [tables, students, sources, docs] = await Promise.all([
		Promise.all(RECRUIT_TABLES.map((t) => rows<never>(sb, t))),
		rows<GameDataRows['students'][number]>(sb, 'students'),
		rows<GameDataRows['sources'][number]>(sb, 'sources'),
		sb
			.from('datasets')
			.select('path, data')
			.in('path', [...DOCS])
	]);
	if (docs.error) fail('datasets', docs.error);
	const doc = (path: string) => docs.data?.find((d) => d.path === path)?.data;
	const bannerTypes =
		(doc(DOCS[0]) as { bannerTypes?: BannerType[] } | undefined)?.bannerTypes ?? [];
	const schedule = (doc(DOCS[1]) as GameConfig | undefined)?.pitySystem.schedule ?? [];
	const firstStack = schedule.find((p) => p.system === 'charge')?.effectiveFrom;
	if (!firstStack) throw new Error('game-config: 모집 스택 전환일(charge)을 찾지 못했어요');

	const recruitRows = Object.fromEntries(
		RECRUIT_TABLES.map((t, i) => [t, tables[i]])
	) as unknown as RecruitTables;
	const studentList = rowsToStudents(students);
	const sourceList = [...sources].sort((a, b) => Number(a.id) - Number(b.id));
	return {
		recruits: rowsToRecruits(recruitRows),
		studentName: new Map(studentList.map((s) => [s.id, s.name.ko])),
		bannerName: new Map(bannerTypes.map((b) => [b.id, b.nameKo])),
		students: studentList.map((s) => ({
			id: s.id,
			label: s.koNameStatus === 'provisional' ? `${s.name.ko} (가칭)` : s.name.ko
		})),
		bannerTypes: bannerTypes
			.filter((b) => b.availableInKo)
			.map((b) => ({ id: b.id, label: b.nameKo })),
		sources: sourceList.map((s) => ({
			id: s.id,
			label: `${s.id} · ${s.publisher} · ${s.title}${s.tier === 'official' ? ' (공식)' : ''}`
		})),
		validation: {
			studentIds: new Set(studentList.map((s) => s.id)),
			sourceTier: new Map(sourceList.map((s) => [s.id, s.tier])),
			bannerAvailable: new Map(bannerTypes.map((b) => [b.id, b.availableInKo])),
			firstStack
		}
	};
}

// ------------------------------------------------------------ 기간 저장·삭제 (DB 함수, supabase/migrations/20261114000000_save_recruit.sql)

export interface SaveOptions {
	/** 일정 확인일을 이 날짜로 (schedule.json meta.recruitsVerifiedAt). null이면 그대로 */
	verifiedAt: string | null;
	/** 같은 저장에서 배포 요청 */
	deploy: boolean;
}

/** 기간 하나를 한 트랜잭션으로 저장하고 저장된 id를 돌려준다. originalId가 null이면 새 기간 */
export async function saveRecruit(
	sb: SupabaseClient,
	originalId: string | null,
	recruit: RecruitPeriod,
	options: SaveOptions
): Promise<string> {
	const { data, error } = await sb.rpc('save_recruit', {
		p_original_id: originalId,
		p_recruit: recruit,
		p_verified_at: options.verifiedAt,
		p_deploy: options.deploy
	});
	if (error) throw new Error(dbErrorMessage(error));
	return data as string;
}

export async function deleteRecruit(
	sb: SupabaseClient,
	id: string,
	deploy: boolean
): Promise<void> {
	const { error } = await sb.rpc('delete_recruit', { p_id: id, p_deploy: deploy });
	if (error) throw new Error(dbErrorMessage(error));
}

/** DB 오류 → 화면 문장. 저장 전 검사를 거쳐도 다른 탭에서 바꾼 것과 부딪히면 여기로 온다 */
export function dbErrorMessage(error: {
	code?: string;
	message: string;
	details?: string | null;
}): string {
	switch (error.code) {
		case '42501':
			return '관리자만 저장할 수 있어요 (로그인이 끝났을 수 있어요)';
		case '23505':
			return error.message.includes('예전 id') || error.message.includes('기간 id')
				? error.message
				: '같은 id의 기간이 이미 있어요';
		case '23503':
			return '없는 학생이나 출처를 가리켜요 (다른 곳에서 지웠을 수 있어요)';
		case '23514':
			return `값이 규칙에 맞지 않아요: ${error.message}`;
		case 'P0002':
			return '그 기간이 이제 없어요 (다른 곳에서 지웠을 수 있어요). 목록을 다시 읽어 주세요';
		case 'PGRST202':
			return '저장 함수가 없어요 — SQL Editor에서 20261114000000_save_recruit.sql을 실행했는지 봐 주세요';
		default:
			return error.message;
	}
}

export interface SaveLog {
	tx: string;
	at: string;
	actor: string | null;
	rows: number;
	tables: string[];
	keys: string[];
}

/** 최근 저장 (change_log_saves — 관리자만 읽을 수 있다) */
export async function loadChangeLog(sb: SupabaseClient, limit = 10): Promise<SaveLog[]> {
	const { data, error } = await sb
		.from('change_log_saves')
		.select('*')
		.order('at', { ascending: false })
		.limit(limit);
	if (error) fail('change_log_saves', error);
	return (data ?? []) as SaveLog[];
}

export interface DeployRequest {
	id: number;
	at: string;
	actor: string | null;
	reason: string;
}

export async function loadDeploys(sb: SupabaseClient, limit = 5): Promise<DeployRequest[]> {
	const { data, error } = await sb
		.from('deploy_requests')
		.select('id, at, actor, reason')
		.order('at', { ascending: false })
		.limit(limit);
	if (error) fail('deploy_requests', error);
	return (data ?? []) as DeployRequest[];
}

/** 배포 요청 한 행 → Database Webhook이 Cloudflare 배포 훅을 부른다 (6-4). reason 칸만 쓸 수 있다 */
export async function requestDeploy(sb: SupabaseClient, reason: string): Promise<void> {
	const { error } = await sb.from('deploy_requests').insert({ reason });
	if (error) fail('deploy_requests', error);
}

// ------------------------------------------------------------ 표시 (순수 함수)

const KST = new Intl.DateTimeFormat('en-CA', {
	timeZone: 'Asia/Seoul',
	month: '2-digit',
	day: '2-digit',
	hour: '2-digit',
	minute: '2-digit',
	hourCycle: 'h23'
});

/** 'MM-DD HH:mm' (한국 시간) */
export function formatKst(iso: string): string {
	const parts = Object.fromEntries(KST.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
	return `${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

/** 'YYYY-MM-DD' 두 개 → 'MM/DD ~ MM/DD' */
export function formatPeriod(start: string, end: string): string {
	const md = (d: string) => `${d.slice(5, 7)}/${d.slice(8, 10)}`;
	return `${md(start)} ~ ${md(end)}`;
}

/** 누가 바꿨나: SQL 편집기(사람 정보 없음) / 나 / 다른 관리자(앞 8자) */
export function actorLabel(actor: string | null, me: string): string {
	if (actor === null) return 'SQL 편집기';
	if (actor === me) return '나';
	return `관리자 ${actor.slice(0, 8)}`;
}

const TABLE_NAMES: Record<string, string> = {
	sources: '출처',
	students: '학생',
	recruits: '기간',
	recruit_previous_ids: '예전 id',
	recruit_banners: '배너',
	banner_students: '배너 학생',
	recruit_off_pickup: '픽업 외',
	recruit_sources: '기간 출처',
	datasets: '문서'
};

export function tableLabel(table: string): string {
	return TABLE_NAMES[table] ?? table;
}

/** 목록이 길면 앞의 몇 개와 "외 n" */
export function shortList(items: readonly string[], max = 3): string {
	if (items.length <= max) return items.join(', ');
	return `${items.slice(0, max).join(', ')} 외 ${items.length - max}`;
}

/** Supabase 로그인 오류 → 화면 문장 */
export function signInMessage(error: { message: string; status?: number }): string {
	if (/invalid login credentials/i.test(error.message)) return '이메일 또는 비밀번호가 맞지 않아요';
	if (/email not confirmed/i.test(error.message)) return '이메일 확인이 끝나지 않은 계정이에요';
	if (error.status === 429) return '시도가 너무 많아요. 잠시 뒤에 다시 해 주세요';
	return `로그인하지 못했어요: ${error.message}`;
}
