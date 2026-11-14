/**
 * 관리자 화면의 Supabase 연결 (docs/006 6-1).
 *
 * 공개용 키 + 로그인 토큰으로 DB를 직접 읽고 쓴다. 쓰기를 막는 것은 DB 보안 규칙(5장)이라 이 화면에는 서버 비밀이 없다.
 * 연결은 방문자 로그인과 같은 하나를 쓴다 ($lib/supabase.ts). 이 화면은 supabase-js를 바로 불러온다.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { supabaseWith } from '$lib/supabase';

/** 설정이 없으면 null (화면이 안내한다) */
export function getSupabase(): SupabaseClient | null {
	return supabaseWith(createClient);
}
