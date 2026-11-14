/**
 * 관리자 화면의 Supabase 연결 (docs/006 6-1).
 *
 * 공개용 키 + 로그인 토큰으로 DB를 직접 읽고 쓴다. 쓰기를 막는 것은 DB 보안 규칙(5장)이라 이 화면에는 서버 비밀이 없다.
 * 값은 $env/dynamic/public — 빌드가 아니라 실행 때 읽는다. 값이 없는 빌드(CI 빌드 검사)도 통과하고,
 * Cloudflare에서는 Secret으로 넣은 값이 실행 때 들어온다 (5-4).
 * 이 파일은 /admin에서만 불러온다 — 방문자 화면의 번들에는 supabase-js가 들어가지 않는다.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/public';

let client: SupabaseClient | null = null;

/** 설정이 없으면 null (화면이 안내한다) */
export function getSupabase(): SupabaseClient | null {
	if (client) return client;
	const url = env.PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, '');
	const key = env.PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
	if (!url || !key) return null;
	client = createClient(url, key, {
		auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
	});
	return client;
}
