/**
 * 관리자 화면이 읽고 쓰는 것 (docs/006 6장). 통신은 얇게, 표시용 계산은 순수 함수로.
 * 표 → 기간 변환은 내보내기와 같은 함수(src/lib/data/db/convert.ts)를 쓴다 — 화면과 사이트가 같은 모양을 본다.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { BannerType, RecruitPeriod } from '$lib/data/types';
import type { GameDataRows } from '$lib/data/db/rows';
import { rowsToRecruits, rowsToStudents } from '$lib/data/db/convert';

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

export interface RecruitOverview {
	recruits: RecruitPeriod[];
	studentName: Map<string, string>;
	bannerName: Map<string, string>;
}

/** 미래시 기간 전부 + 이름표 (학생·배너 종류) */
export async function loadRecruits(sb: SupabaseClient): Promise<RecruitOverview> {
	const [tables, students, bannerDoc] = await Promise.all([
		Promise.all(RECRUIT_TABLES.map((t) => rows<never>(sb, t))),
		rows<GameDataRows['students'][number]>(sb, 'students'),
		sb.from('datasets').select('data').eq('path', 'ko/banner-types.json').maybeSingle()
	]);
	if (bannerDoc.error) fail('datasets', bannerDoc.error);
	const recruitRows = Object.fromEntries(
		RECRUIT_TABLES.map((t, i) => [t, tables[i]])
	) as unknown as RecruitTables;
	const doc = bannerDoc.data?.data as { bannerTypes?: BannerType[] } | undefined;
	return {
		recruits: rowsToRecruits(recruitRows),
		studentName: new Map(rowsToStudents(students).map((s) => [s.id, s.name.ko])),
		bannerName: new Map((doc?.bannerTypes ?? []).map((b) => [b.id, b.nameKo]))
	};
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
