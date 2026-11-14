/**
 * 계정 저장값 맞추기 (docs/007 4장, ⑥-3). 화면 전체에 하나 — AccountSync.svelte가 로그인 상태를 보고 켜고 끈다.
 *
 * - 시작(로그인, 화면을 다시 열 때): 계정 값을 읽어 decideOnStart대로 올리거나 받거나 묻는다
 * - 이 기기에 저장할 때마다(SavedStore.onLocalWrite) 2초 모아서, 지문이 맞춘 때와 다르면 올린다
 * - 올릴 때 판이 다르면(다른 기기에서 먼저 저장, P0001) 다시 읽어 묻는다 — 몰래 덮지 않는다
 * - 연결이 끊기면 이 기기에만 저장해 두고, 다시 연결되거나 화면으로 돌아오면 올린다
 * - 공유 링크를 보는 동안(저장 멈춤)에는 시작하지 않는다
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadSupabase } from './supabase';
import { parseSaveFile, type SaveFile } from './state/persist';
import type { SavedStore } from './state/saved.svelte';
import { decideOnStart, fingerprint, readMeta, writeMeta, type Remote } from './sync';

export type SyncStatus =
	| { kind: 'idle' }
	| { kind: 'checking' }
	| { kind: 'saving' }
	| { kind: 'saved'; at: Date }
	| { kind: 'offline' }
	| { kind: 'choose' }
	| { kind: 'error'; message: string };

export interface Conflict {
	local: SaveFile;
	remote: Remote;
}

const DEBOUNCE_MS = 2000;

function storage(): Storage | undefined {
	try {
		return localStorage;
	} catch {
		return undefined;
	}
}

/** fetch가 닿지 않은 오류 (오프라인) — 코드가 없다 */
function isNetworkError(error: { code?: string; message?: string }): boolean {
	return !error.code && /fetch|network|load failed/i.test(error.message ?? '');
}

class AccountSync {
	status = $state<SyncStatus>({ kind: 'idle' });
	/** 묻기 창에 보일 두 값. 고르면 null */
	conflict = $state.raw<Conflict | null>(null);

	#store: SavedStore | null = null;
	#userId: string | null = null;
	#sb: SupabaseClient | null = null;
	#timer: ReturnType<typeof setTimeout> | undefined;
	#busy = false;
	#again = false;
	#off: (() => void)[] = [];

	/** 로그인한 사람으로 맞추기를 켠다 (같은 사람이면 그대로) */
	async start(store: SavedStore, userId: string) {
		if (this.#userId === userId && this.#store === store) return;
		this.stop();
		this.#store = store;
		this.#userId = userId;
		this.#sb = await loadSupabase();
		if (!this.#sb || this.#userId !== userId) return;

		this.#off.push(store.onLocalWrite(() => this.#schedule()));
		const retry = () => {
			if (this.status.kind === 'offline' || this.status.kind === 'error') void this.#check();
		};
		const onVisible = () => document.visibilityState === 'visible' && retry();
		window.addEventListener('online', retry);
		document.addEventListener('visibilitychange', onVisible);
		this.#off.push(() => window.removeEventListener('online', retry));
		this.#off.push(() => document.removeEventListener('visibilitychange', onVisible));

		await this.#check();
	}

	/** 로그아웃·공유 링크 보기. 맞춘 기록은 남긴다 (다시 로그인하면 이어서) */
	stop() {
		clearTimeout(this.#timer);
		for (const off of this.#off) off();
		this.#off = [];
		this.#store = null;
		this.#userId = null;
		this.conflict = null;
		this.status = { kind: 'idle' };
	}

	/** 계정 삭제 뒤: 맞춘 기록까지 지운다 */
	forget() {
		this.stop();
		writeMeta(null, storage());
	}

	/** 묻기 창에서 고른다 */
	async choose(which: 'device' | 'account') {
		const c = this.conflict;
		if (!c || !this.#store) return;
		this.conflict = null;
		if (which === 'account') this.#apply(c.remote);
		else await this.#upload(c.remote.updatedAt);
	}

	/** 묻기 창에서 "나중에" — 고를 때까지 맞추지 않는다 (계정 창의 "고르기"나 다음에 열 때 다시 묻는다) */
	postpone() {
		this.conflict = null;
		this.status = { kind: 'choose' };
	}

	/** 미뤄 둔 묻기를 다시 */
	async reopen() {
		await this.#check();
	}

	async #fetchRemote(): Promise<Remote | null> {
		const { data, error } = await this.#sb!.from('user_saves')
			.select('data, updated_at')
			.eq('user_id', this.#userId!)
			.maybeSingle();
		if (error) throw error;
		return data ? { data: data.data, updatedAt: data.updated_at as string } : null;
	}

	/** 계정 값을 읽고 정한다 */
	async #check() {
		const store = this.#store;
		const userId = this.#userId;
		if (!store || !userId || !this.#sb) return;
		this.status = { kind: 'checking' };
		let remote: Remote | null;
		try {
			remote = await this.#fetchRemote();
		} catch (e) {
			this.#fail(e as { code?: string; message?: string });
			return;
		}
		if (this.#userId !== userId) return;
		const local = store.exportFile();
		const decision = decideOnStart(readMeta(storage()), userId, local, remote);
		switch (decision.kind) {
			case 'upload':
				await this.#upload(decision.expected);
				break;
			case 'apply':
				this.#apply(remote!);
				break;
			case 'same':
				this.#remember(remote!.updatedAt, local);
				this.status = { kind: 'saved', at: new Date(remote!.updatedAt) };
				break;
			case 'ask':
				this.conflict = { local, remote: remote! };
				this.status = { kind: 'choose' };
				break;
		}
	}

	#remember(syncedAt: string, file: SaveFile) {
		writeMeta({ userId: this.#userId!, syncedAt, syncedHash: fingerprint(file) }, storage());
	}

	#apply(remote: Remote) {
		const store = this.#store!;
		const file = parseSaveFile(JSON.stringify(remote.data));
		store.importFile(file, { fromAccount: true });
		// 받은 값의 지문 (화면이 다시 읽으며 고쳐 쓴 칸이 있으면 다음 저장 때 한 번 올라간다)
		this.#remember(remote.updatedAt, store.exportFile());
		this.status = { kind: 'saved', at: new Date(remote.updatedAt) };
	}

	#schedule() {
		if (!this.#store || this.conflict || this.status.kind === 'choose') return;
		clearTimeout(this.#timer);
		this.#timer = setTimeout(() => void this.#maybeUpload(), DEBOUNCE_MS);
	}

	async #maybeUpload() {
		const store = this.#store;
		if (!store || this.conflict) return;
		const meta = readMeta(storage());
		if (!meta || meta.userId !== this.#userId) return void this.#check();
		if (fingerprint(store.exportFile()) === meta.syncedHash) return;
		await this.#upload(meta.syncedAt);
	}

	/** 이 기기 값을 올린다. expected: 먼저 읽은 판 (처음이면 null) */
	async #upload(expected: string | null) {
		if (this.#busy) {
			this.#again = true;
			return;
		}
		const store = this.#store;
		const userId = this.#userId;
		if (!store || !userId || !this.#sb) return;
		this.#busy = true;
		this.status = { kind: 'saving' };
		const file = store.exportFile();
		let recheck = false;
		try {
			const { data, error } = await this.#sb.rpc('save_my_data', {
				p_data: file,
				p_expected: expected
			});
			if (this.#userId !== userId) return;
			if (error) {
				// 판이 다르다 (다른 기기에서 먼저 저장, 또는 계정 값이 지워짐) → 다시 읽어 정한다
				if (error.code === 'P0001') recheck = true;
				else this.#fail(error);
				return;
			}
			this.#remember(data as string, file);
			this.status = { kind: 'saved', at: new Date(data as string) };
		} catch (e) {
			this.#fail(e as { code?: string; message?: string });
		} finally {
			this.#busy = false;
			// 다시 읽기는 busy를 푼 뒤에 — 그 안에서 다시 올릴 수 있게
			if (recheck) {
				this.#again = false;
				void this.#check();
			} else if (this.#again) {
				this.#again = false;
				void this.#maybeUpload();
			}
		}
	}

	#fail(error: { code?: string; message?: string }) {
		this.status = isNetworkError(error)
			? { kind: 'offline' }
			: { kind: 'error', message: error.message ?? String(error) };
	}
}

export const accountSync = new AccountSync();
