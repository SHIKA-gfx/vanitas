/**
 * Supabase 연결 하나 (docs/006 6-1, docs/007 5장).
 *
 * 관리자 화면과 방문자 화면(로그인)이 같은 연결을 쓴다 — 같은 브라우저에 연결이 둘이면 로그인 정보를 서로 덮는다.
 * - 관리자 화면은 supabase-js를 이미 불러왔으므로 바로 만든다 (supabaseWith)
 * - 방문자 화면은 로그인 단추를 누르거나 이 기기에 로그인 기록이 있을 때만 불러온다 (loadSupabase) —
 *   로그인하지 않는 방문자의 첫 화면에는 supabase-js가 들어가지 않는다
 *
 * 값은 $env/dynamic/public — 빌드가 아니라 실행 때 읽는다 (5-4). 브라우저에서만 부른다.
 * 쓰기를 막는 것은 DB 보안 규칙이라 이 연결에는 서버 비밀이 없다.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/public';

type CreateClient = typeof import('@supabase/supabase-js').createClient;

let client: SupabaseClient | null = null;

function config(): { url: string; key: string } | null {
	const url = env.PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, '');
	const key = env.PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
	return url && key ? { url, key } : null;
}

function make(createClient: CreateClient): SupabaseClient | null {
	if (client) return client;
	const cfg = config();
	if (!cfg) return null;
	client = createClient(cfg.url, cfg.key, {
		auth: {
			persistSession: true,
			autoRefreshToken: true,
			// 로그인에서 돌아온 주소(?code=)는 /auth/callback이 직접 바꾼다
			detectSessionInUrl: false,
			flowType: 'pkce'
		}
	});
	return client;
}

/** supabase-js를 이미 불러온 곳(관리자 화면). 설정이 없으면 null */
export function supabaseWith(createClient: CreateClient): SupabaseClient | null {
	return make(createClient);
}

/** 필요할 때 불러온다. 설정이 없으면 null */
export async function loadSupabase(): Promise<SupabaseClient | null> {
	if (client) return client;
	if (!config()) return null;
	const { createClient } = await import('@supabase/supabase-js');
	return make(createClient);
}
