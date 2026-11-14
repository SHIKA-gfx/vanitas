/**
 * 로그인 저장 — 순수 함수 (docs/007). 연결·화면은 account.svelte.ts와 AccountButton이 한다.
 */

export type Provider = 'google' | 'kakao';
export const PROVIDERS: readonly Provider[] = ['google', 'kakao'];

/**
 * 로그인 단추를 열었는가 (⑥-3에서 true). 그 전에는 주소에 ?accounts=preview를 붙인 브라우저에서만 보인다 —
 * 운영 사이트에서 실제 구글·카카오 로그인을 시험하려고. ?accounts=off로 끈다. 이 기기에 로그인 기록이 있으면 늘 보인다(로그아웃하게)
 */
export const ACCOUNTS_OPEN = false;
export const PREVIEW_KEY = 'vanitas:accounts-preview';
/** 로그인에서 돌아갈 화면 (이 탭에만) */
export const RETURN_KEY = 'vanitas:auth-return';

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function accountsVisible(
	search: URLSearchParams,
	storage: Store | undefined,
	signedIn: boolean
): boolean {
	if (ACCOUNTS_OPEN || signedIn) return true;
	try {
		const flag = search.get('accounts');
		if (flag === 'preview') storage?.setItem(PREVIEW_KEY, '1');
		if (flag === 'off') storage?.removeItem(PREVIEW_KEY);
		return storage?.getItem(PREVIEW_KEY) === '1';
	} catch {
		return false;
	}
}

/** supabase-js가 로그인 정보를 두는 키 (sb-<프로젝트>-auth-token). 있으면 연결을 불러와 확인한다 */
export function hasSessionHint(keys: readonly string[]): boolean {
	return keys.some((k) => /^sb-.+-auth-token$/.test(k));
}

/** 돌아갈 화면: 이 사이트 안의 경로만 (//다른곳, https://… 은 홈으로) */
export function safeReturnPath(path: string | null, fallback: string): string {
	if (!path || !path.startsWith('/') || path.startsWith('//') || path.includes('\\'))
		return fallback;
	return path;
}

export interface AccountUser {
	id: string;
	provider: string;
	/** 제공자가 준 이름(없으면 null). 화면에는 첫 글자만 */
	name: string | null;
}

interface SupabaseUserLike {
	id: string;
	app_metadata?: Record<string, unknown>;
	user_metadata?: Record<string, unknown>;
}

export function toAccountUser(u: SupabaseUserLike): AccountUser {
	const meta = u.user_metadata ?? {};
	const name = ['full_name', 'name', 'nickname', 'preferred_username', 'user_name']
		.map((k) => meta[k])
		.find((v): v is string => typeof v === 'string' && v.trim() !== '');
	const provider = u.app_metadata?.provider;
	return {
		id: u.id,
		provider: typeof provider === 'string' ? provider : 'unknown',
		name: name?.trim() ?? null
	};
}

/** 계정 단추의 글자: 이름 첫 글자, 없으면 null(화면이 "계정"이라고 쓴다) */
export function initialOf(user: AccountUser): string | null {
	const first = user.name ? [...user.name][0] : undefined;
	return first ? first.toUpperCase() : null;
}

/**
 * 로그인에서 돌아온 주소의 오류 → 화면 문장의 종류.
 * Supabase는 ?error=…&error_description=…로 돌려준다 (가입을 막아 둔 때, 훅이 거부한 때, 사용자가 취소한 때)
 */
export type CallbackProblem =
	| { kind: 'cancelled' }
	| { kind: 'signup-closed' }
	| { kind: 'rejected'; message: string }
	| { kind: 'failed'; message: string }
	| { kind: 'no-code' };

export function callbackProblem(search: URLSearchParams): CallbackProblem | null {
	const error = search.get('error') ?? search.get('error_code');
	const description = (search.get('error_description') ?? '').replace(/\+/g, ' ').trim();
	if (error) {
		if (error === 'access_denied' && !description) return { kind: 'cancelled' };
		if (/user (cancel|denied)|cancel/i.test(description)) return { kind: 'cancelled' };
		if (/signups? not allowed/i.test(description)) return { kind: 'signup-closed' };
		if (/hook|구글이나 카카오/i.test(description))
			return { kind: 'rejected', message: description };
		return { kind: 'failed', message: description || error };
	}
	if (!search.get('code')) return { kind: 'no-code' };
	return null;
}
