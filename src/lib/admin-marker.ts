/**
 * 관리자 표시 (docs/006 6-1, 결정 G).
 *
 * /admin이 관리자 확인(is_admin())에 성공하면 이 브라우저에 표시를 남기고, 로그아웃하거나 관리자가 아니면 지운다.
 * 홈은 이 표시만 보고 "관리자 페이지" 버튼을 그린다 — 방문자 화면은 Supabase를 부르지 않는다.
 *
 * 보안 장치가 아니다. 누가 표시를 만들어도 보이는 것은 /admin으로 가는 링크뿐이고,
 * 그 안에서 로그인과 DB 보안 규칙이 다시 막는다.
 * 저장값(vanitas:v1)과 따로 두어 백업 링크·공유 링크에 실리지 않는다.
 */
export const ADMIN_MARKER_KEY = 'vanitas:admin';

type Reader = Pick<Storage, 'getItem'>;
type Writer = Pick<Storage, 'setItem' | 'removeItem'>;

function browserStorage(): Storage | undefined {
	try {
		return globalThis.localStorage;
	} catch {
		return undefined; // 저장소 접근 자체가 막힌 브라우저
	}
}

/** 저장소를 쓸 수 없는 브라우저(사생활 모드 등)에서는 없음으로 본다 */
export function hasAdminMarker(storage: Reader | undefined = browserStorage()): boolean {
	try {
		return storage?.getItem(ADMIN_MARKER_KEY) === '1';
	} catch {
		return false;
	}
}

export function setAdminMarker(on: boolean, storage: Writer | undefined = browserStorage()): void {
	try {
		if (on) storage?.setItem(ADMIN_MARKER_KEY, '1');
		else storage?.removeItem(ADMIN_MARKER_KEY);
	} catch {
		// 저장소를 쓸 수 없으면 버튼이 안 보일 뿐이다
	}
}
