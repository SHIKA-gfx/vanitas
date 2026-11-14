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
/** 이 기기에서 마지막으로 고른 로그인 수단 (google · kakao · email). 계정 창의 "○○ 계정으로 로그인했어요"에 쓴다 */
export const PROVIDER_KEY = 'vanitas:auth-provider';

/** 로그인 수단을 기억한다 (로그인 단추·관리자 화면의 비밀번호 로그인). null이면 지운다(로그아웃) */
export function rememberProvider(
	provider: string | null,
	storage?: Pick<Storage, 'setItem' | 'removeItem'>
) {
	try {
		const s = storage ?? localStorage;
		if (provider) s.setItem(PROVIDER_KEY, provider);
		else s.removeItem(PROVIDER_KEY);
	} catch {
		// 기억하지 못하면 계정 정보로 짐작한다
	}
}

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
	/** 이번에 로그인한 수단 (google · kakao · email …) */
	provider: string;
	/** 제공자가 준 이름(없으면 null). 계정 창에서 어느 계정인지 보여 주는 데만 쓴다 */
	name: string | null;
}

interface SupabaseUserLike {
	id: string;
	app_metadata?: Record<string, unknown>;
	user_metadata?: Record<string, unknown>;
	identities?: readonly { provider?: string; last_sign_in_at?: string | null }[] | null;
}

/**
 * 이번에 로그인한 수단. app_metadata.provider는 계정을 **처음 만든** 수단이라, 같은 이메일로 계정이 이어진 경우
 * (예: 이메일로 만든 관리자 계정에 같은 Gmail의 구글 로그인이 붙음 — Supabase가 자동으로 잇는다) 틀린다 (2026-11-15).
 * → ① 이 기기에서 고른 수단이 이 계정에 붙어 있으면 그것 ② 연결된 수단(identities) 가운데 마지막으로 로그인한 것
 *   (비밀번호 로그인은 이 시각을 바꾸지 않아 ①이 먼저다) ③ app_metadata
 */
function currentProvider(u: SupabaseUserLike, remembered: string | null): string {
	const linked = new Set<string>([
		...(u.identities ?? [])
			.map((i) => i.provider)
			.filter((p): p is string => typeof p === 'string'),
		...(Array.isArray(u.app_metadata?.providers)
			? (u.app_metadata.providers as unknown[])
			: []
		).filter((p): p is string => typeof p === 'string'),
		...(typeof u.app_metadata?.provider === 'string' ? [u.app_metadata.provider] : [])
	]);
	if (remembered && linked.has(remembered)) return remembered;
	const latest = [...(u.identities ?? [])]
		.filter((i) => typeof i.provider === 'string' && typeof i.last_sign_in_at === 'string')
		.sort((a, b) => Date.parse(b.last_sign_in_at!) - Date.parse(a.last_sign_in_at!))[0];
	if (latest?.provider) return latest.provider;
	const first = u.app_metadata?.provider;
	return typeof first === 'string' ? first : 'unknown';
}

export function toAccountUser(u: SupabaseUserLike, remembered: string | null = null): AccountUser {
	const meta = u.user_metadata ?? {};
	const name = ['full_name', 'name', 'nickname', 'preferred_username', 'user_name']
		.map((k) => meta[k])
		.find((v): v is string => typeof v === 'string' && v.trim() !== '');
	return { id: u.id, provider: currentProvider(u, remembered), name: name?.trim() ?? null };
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
