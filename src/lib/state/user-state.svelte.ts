// 여러 계산기가 함께 쓰는 사용자 값.
// 한 계산기에서만 쓰는 값(레벨, 카페 랭크, 배너 선택 등)은 각 페이지에 둔다.
//
// 모듈 전역 $state가 아니라 컨텍스트로 내려주는 이유:
// SvelteKit은 서버에서도 페이지를 그리므로, 전역 상태는 서버에서 여러 사용자가 공유할 수 있다.
// 최상위 레이아웃이 방문자마다 하나씩 만들어 내려준다.
//
// 유지 기간: 새로고침 전까지. 저장 방식(브라우저 저장 / 공유 링크 / 로그인)이 정해지면
// 저장·복원은 이 파일에만 붙인다.

import { getContext, setContext } from 'svelte';

export interface UserState {
	/** 보유 재화 — 천장·확률 계산기, 청휘석 수급 계산기, 플래너 */
	resources: {
		/** 보유 청휘석 */
		gems: number;
		/** 1회 모집 티켓 */
		singleTickets: number;
		/** 10회 모집 티켓 */
		tenPullTickets: number;
		/** 모집 포인트. 풀마다 따로 쌓인다 (PointPool.id → 값) */
		pointsByPool: Record<string, number>;
	};
	/** 플레이 습관 — 레벨업 계산기, 청휘석 수급 계산기 */
	habits: {
		/** 하루 청휘석 AP 구매 횟수 */
		apPurchasesPerDay: number;
	};
}

const KEY = Symbol('user-state');

export function createUserState(): UserState {
	// $state는 변수 선언이나 클래스 필드에만 쓸 수 있어서 한 번 담아서 돌려준다
	const state: UserState = $state({
		resources: { gems: 0, singleTickets: 0, tenPullTickets: 0, pointsByPool: {} },
		habits: { apPurchasesPerDay: 0 }
	});
	return state;
}

/** 최상위 레이아웃에서 한 번 부른다 */
export function provideUserState(state: UserState = createUserState()): UserState {
	return setContext(KEY, state);
}

/** 페이지·컴포넌트에서 꺼내 쓴다 */
export function getUserState(): UserState {
	const state = getContext<UserState | undefined>(KEY);
	if (!state)
		throw new Error('UserState가 없습니다. 최상위 레이아웃에서 provideUserState()를 부르세요.');
	return state;
}
