/**
 * 로그인 상태 (docs/007 5장). 화면 전체에 하나 — 왼쪽 목록과 홈의 계정 단추, /auth/callback이 같이 본다.
 *
 * 브라우저에서만 움직인다(start). 이 기기에 로그인 기록이 없으면 Supabase를 불러오지 않는다.
 * 저장값 맞추기는 ⑥-3 (docs/007 4장).
 */
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { browser } from '$app/environment';
import { setAdminMarker } from './admin-marker';
import { loadSupabase } from './supabase';
import {
	hasSessionHint,
	RETURN_KEY,
	toAccountUser,
	type AccountUser,
	type Provider
} from './account';

function storageKeys(): string[] {
	try {
		return Object.keys(localStorage);
	} catch {
		return [];
	}
}

class AccountState {
	/** 로그인한 사람. 확인 전이거나 로그아웃이면 null */
	user = $state<AccountUser | null>(null);
	/** 이 기기의 로그인 기록을 확인했는가 */
	ready = $state(false);
	#started = false;
	#listening = false;

	/** 화면이 처음 뜰 때. 로그인 기록이 있을 때만 연결한다 */
	start() {
		if (!browser || this.#started) return;
		this.#started = true;
		if (hasSessionHint(storageKeys())) void this.connect();
		else this.ready = true;
	}

	/** 연결을 불러오고 지금 세션을 읽는다. 설정이 없으면 null */
	async connect(): Promise<SupabaseClient | null> {
		const sb = await loadSupabase();
		if (!sb) {
			this.ready = true;
			return null;
		}
		if (!this.#listening) {
			this.#listening = true;
			// 다른 탭의 로그인·로그아웃, 토큰 갱신. 이 콜백 안에서는 Supabase를 다시 부르지 않는다
			sb.auth.onAuthStateChange((_event, session) => this.#apply(session));
		}
		const { data } = await sb.auth.getSession();
		this.#apply(data.session);
		this.ready = true;
		return sb;
	}

	#apply(session: Session | null) {
		this.user = session ? toAccountUser(session.user) : null;
	}

	/** 제공자 화면으로 간다. 돌아오면 /auth/callback이 이어 받는다 */
	async signIn(provider: Provider, callbackUrl: string, returnPath: string): Promise<void> {
		const sb = await this.connect();
		if (!sb) throw new Error('로그인 설정이 없어요');
		try {
			sessionStorage.setItem(RETURN_KEY, returnPath);
		} catch {
			// 돌아갈 화면을 못 기억하면 홈으로 간다
		}
		const { error } = await sb.auth.signInWithOAuth({
			provider,
			options: { redirectTo: callbackUrl }
		});
		if (error) throw error;
	}

	/** 돌아온 주소의 code를 세션으로 바꾼다 */
	async finish(code: string): Promise<void> {
		const sb = await this.connect();
		if (!sb) throw new Error('로그인 설정이 없어요');
		const { data, error } = await sb.auth.exchangeCodeForSession(code);
		if (error) throw error;
		this.#apply(data.session);
	}

	async signOut(): Promise<void> {
		const sb = await loadSupabase();
		await sb?.auth.signOut();
		setAdminMarker(false);
		this.user = null;
	}

	/** 계정과 계정에 저장된 입력값을 지운다 (이 기기의 입력값은 남는다, 결정 J). 관리자 계정은 DB가 거부한다 */
	async deleteAccount(): Promise<void> {
		const sb = await loadSupabase();
		if (!sb) throw new Error('로그인 설정이 없어요');
		const { error } = await sb.rpc('delete_my_account');
		if (error) throw error;
		// 서버의 계정은 이미 없다 — 이 기기의 로그인 정보만 지운다
		await sb.auth.signOut({ scope: 'local' });
		this.user = null;
	}
}

export const account = new AccountState();
