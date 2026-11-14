import { describe, expect, it } from 'vitest';
import {
	accountsVisible,
	callbackProblem,
	hasSessionHint,
	PREVIEW_KEY,
	safeReturnPath,
	toAccountUser
} from './account';

function memory(): Storage {
	const m = new Map<string, string>();
	return {
		getItem: (k) => m.get(k) ?? null,
		setItem: (k, v) => void m.set(k, v),
		removeItem: (k) => void m.delete(k),
		clear: () => m.clear(),
		key: () => null,
		get length() {
			return m.size;
		}
	};
}

describe('로그인 단추 보이기', () => {
	it('열기 전에는 ?accounts=preview를 붙인 브라우저에서만, off로 끈다', () => {
		const s = memory();
		expect(accountsVisible(new URLSearchParams(''), s, false)).toBe(false);
		expect(accountsVisible(new URLSearchParams('accounts=preview'), s, false)).toBe(true);
		expect(s.getItem(PREVIEW_KEY)).toBe('1');
		expect(accountsVisible(new URLSearchParams(''), s, false)).toBe(true);
		expect(accountsVisible(new URLSearchParams('accounts=off'), s, false)).toBe(false);
	});

	it('로그인한 기기는 늘 보인다 (로그아웃하게). 저장소가 없어도 멈추지 않는다', () => {
		expect(accountsVisible(new URLSearchParams(''), undefined, true)).toBe(true);
		expect(accountsVisible(new URLSearchParams('accounts=preview'), undefined, false)).toBe(false);
	});
});

describe('로그인 기록·돌아갈 곳', () => {
	it('supabase-js의 키만', () => {
		expect(hasSessionHint(['vanitas:v1', 'sb-abcd-auth-token'])).toBe(true);
		expect(hasSessionHint(['vanitas:v1', 'sb-abcd-auth-token-code-verifier'])).toBe(false);
		expect(hasSessionHint([])).toBe(false);
	});

	it('사이트 안의 경로만', () => {
		expect(safeReturnPath('/ko/planner?s=abc', '/ko')).toBe('/ko/planner?s=abc');
		expect(safeReturnPath('//evil.example', '/ko')).toBe('/ko');
		expect(safeReturnPath('https://evil.example', '/ko')).toBe('/ko');
		expect(safeReturnPath('/\\evil.example', '/ko')).toBe('/ko');
		expect(safeReturnPath(null, '/ko')).toBe('/ko');
	});
});

describe('계정 정보', () => {
	it('제공자와 이름', () => {
		const g = toAccountUser({
			id: 'u1',
			app_metadata: { provider: 'google' },
			user_metadata: { full_name: 'shika kim' }
		});
		expect(g).toEqual({ id: 'u1', provider: 'google', name: 'shika kim' });
		const k = toAccountUser({
			id: 'u2',
			app_metadata: { provider: 'kakao' },
			user_metadata: { name: '시카' }
		});
		expect(k.name).toBe('시카');
		const none = toAccountUser({ id: 'u3' });
		expect(none).toEqual({ id: 'u3', provider: 'unknown', name: null });
	});

	it('이어진 계정은 마지막으로 로그인한 수단 (처음 만든 수단이 아니라)', () => {
		const linked = toAccountUser({
			id: 'admin',
			app_metadata: { provider: 'email', providers: ['email', 'google'] },
			user_metadata: { full_name: 'JAEHYEON KIM' },
			identities: [
				{ provider: 'email', last_sign_in_at: '2026-11-14T08:00:00Z' },
				{ provider: 'google', last_sign_in_at: '2026-11-15T00:20:00Z' }
			]
		});
		expect(linked.provider).toBe('google');
		const viaEmail = toAccountUser({
			id: 'admin',
			app_metadata: { provider: 'email' },
			identities: [
				{ provider: 'email', last_sign_in_at: '2026-11-15T01:00:00Z' },
				{ provider: 'google', last_sign_in_at: '2026-11-15T00:20:00Z' }
			]
		});
		expect(viaEmail.provider).toBe('email');
		expect(toAccountUser({ id: 'x', identities: null }).provider).toBe('unknown');
	});

	it('이 기기에서 고른 수단이 이 계정에 붙어 있으면 그것이 먼저', () => {
		const u = {
			id: 'admin',
			app_metadata: { provider: 'email', providers: ['email', 'google'] },
			identities: [
				{ provider: 'email', last_sign_in_at: '2026-11-14T08:00:00Z' },
				{ provider: 'google', last_sign_in_at: '2026-11-15T00:20:00Z' }
			]
		};
		// 구글로 로그인한 뒤 관리자 화면에서 비밀번호로 다시 로그인 — 비밀번호 로그인은 시각을 바꾸지 않는다
		expect(toAccountUser(u, 'email').provider).toBe('email');
		expect(toAccountUser(u, 'google').provider).toBe('google');
		// 이 계정에 없는 수단을 기억하고 있으면 무시
		expect(toAccountUser(u, 'kakao').provider).toBe('google');
	});
});

describe('돌아온 주소의 오류', () => {
	const p = (q: string) => callbackProblem(new URLSearchParams(q));
	it('종류별', () => {
		expect(p('code=abc')).toBeNull();
		expect(p('')).toEqual({ kind: 'no-code' });
		expect(p('error=access_denied')).toEqual({ kind: 'cancelled' });
		expect(p('error=access_denied&error_description=User+denied+access')).toEqual({
			kind: 'cancelled'
		});
		expect(
			p('error=access_denied&error_description=Signups+not+allowed+for+this+instance')
		).toEqual({
			kind: 'signup-closed'
		});
		expect(p('error=server_error&error_description=구글이나 카카오로 로그인해 주세요')).toEqual({
			kind: 'rejected',
			message: '구글이나 카카오로 로그인해 주세요'
		});
		expect(p('error=server_error&error_description=Unable+to+exchange+external+code')).toEqual({
			kind: 'failed',
			message: 'Unable to exchange external code'
		});
	});
});
