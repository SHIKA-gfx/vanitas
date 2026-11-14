/**
 * 계정 저장값 맞추기 — 순수 함수 (docs/007 4장, ⑥-3). 연결은 sync.svelte.ts.
 *
 * 이 기기에 `vanitas:sync` = { userId, syncedAt, syncedHash }를 둔다.
 * - syncedAt: 마지막으로 계정과 맞춘 판(user_saves.updated_at)
 * - syncedHash: 그때의 저장 파일 지문. 지금 파일의 지문과 다르면 "이 기기에서 고침" (dirty)
 *   로그아웃한 동안 고친 것도 지문이 달라 다음 로그인 때 알아챈다
 * 저장값(vanitas:v1)과 따로 둔다 — 백업 링크·공유 링크에 실리지 않는다.
 */
import type { SaveFile } from './state/persist';

export const SYNC_KEY = 'vanitas:sync';

export interface SyncMeta {
	userId: string;
	syncedAt: string;
	syncedHash: string;
}

export interface Remote {
	data: unknown;
	updatedAt: string;
}

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function readMeta(storage: Store | undefined): SyncMeta | null {
	try {
		const raw = JSON.parse(storage?.getItem(SYNC_KEY) ?? 'null') as Partial<SyncMeta> | null;
		if (
			raw &&
			typeof raw.userId === 'string' &&
			typeof raw.syncedAt === 'string' &&
			typeof raw.syncedHash === 'string'
		) {
			return { userId: raw.userId, syncedAt: raw.syncedAt, syncedHash: raw.syncedHash };
		}
	} catch {
		// 깨졌으면 처음 로그인처럼
	}
	return null;
}

export function writeMeta(meta: SyncMeta | null, storage: Store | undefined): void {
	try {
		if (meta) storage?.setItem(SYNC_KEY, JSON.stringify(meta));
		else storage?.removeItem(SYNC_KEY);
	} catch {
		// 기억하지 못하면 다음에 처음 로그인처럼 묻는다
	}
}

/** 키 순서와 상관없는 글자 (같은 값인지 견줄 때) */
export function canonical(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
	if (value && typeof value === 'object') {
		const entries = Object.entries(value as Record<string, unknown>)
			.filter(([, v]) => v !== undefined)
			.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
		return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
	}
	return JSON.stringify(value ?? null);
}

/** 지문 (FNV-1a 32비트, 16진수) — 같은 값이면 같다. 보안용이 아니다 */
export function fingerprint(value: unknown): string {
	const text = canonical(value);
	let h = 0x811c9dc5;
	for (let i = 0; i < text.length; i++) {
		h ^= text.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return (h >>> 0).toString(16).padStart(8, '0');
}

export type Decision =
	/** 이 기기 값을 올린다. expected: 먼저 읽은 판 (처음이면 null) */
	| { kind: 'upload'; expected: string | null }
	/** 계정 값을 받는다 */
	| { kind: 'apply' }
	/** 둘 다 바뀌었다 — 묻는다 */
	| { kind: 'ask' }
	/** 이미 같다. 이 판을 맞춘 판으로 */
	| { kind: 'same' };

/** 로그인했거나 화면을 다시 열었을 때 (docs/007 4장 표) */
export function decideOnStart(
	meta: SyncMeta | null,
	userId: string,
	local: SaveFile,
	remote: Remote | null
): Decision {
	const localHash = fingerprint(local);
	if (!remote) return { kind: 'upload', expected: null };
	const remoteHash = fingerprint(remote.data);
	if (localHash === remoteHash) return { kind: 'same' };
	// 이 기기에서 이 사람과 맞춘 적이 없다 (처음 로그인, 다른 사람이 쓰던 기기)
	if (!meta || meta.userId !== userId) return { kind: 'ask' };
	const dirty = localHash !== meta.syncedHash;
	if (remote.updatedAt === meta.syncedAt) {
		return dirty ? { kind: 'upload', expected: meta.syncedAt } : { kind: 'same' };
	}
	return dirty ? { kind: 'ask' } : { kind: 'apply' };
}

/** 묻기 창에 보일 요약 */
export interface SaveSummary {
	gems: number | null;
	targets: number | null;
}

export function summarize(file: unknown): SaveSummary {
	const sections =
		file && typeof file === 'object'
			? (file as { sections?: Record<string, unknown> }).sections
			: null;
	const user = sections?.user as { gems?: unknown } | undefined;
	const planner = sections?.planner as { targets?: unknown } | undefined;
	return {
		gems: typeof user?.gems === 'number' ? user.gems : null,
		targets: Array.isArray(planner?.targets) ? planner.targets.length : null
	};
}
