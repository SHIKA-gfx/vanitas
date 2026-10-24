/*
 * 움직임 공통 (2026-10-23, 디자인 문서 5-18·5-19, 8-2 F).
 * 원칙 6: 움직임은 상태가 바뀔 때만. 값이 바뀐 것, 화면이 이어진 것, 답이 나온 것을 알린다.
 * 줄인 움직임 설정이면 모두 즉시 바뀐다. 브라우저에서만 부른다 (서버 렌더링 중에는 부르지 않는다).
 */
import { prefersReducedMotion } from 'svelte/motion';

/** 숫자 굴림·결과판 반응·누름 효과가 같은 박자를 쓰도록 한곳에 둔다 */
export const MOTION = {
	/** 숫자가 이전 값에서 새 값으로 굴러가는 시간 */
	roll: 300,
	/** 입력이 멈췄다고 보고 결과판이 한 번 반응하기까지 기다리는 시간 */
	settle: 180,
	/** 화면이 바뀐 뒤 결과판이 자리 잡는 때 (layout.css "화면 전환"의 vt-result 시작) */
	arrival: 180
} as const;

export const reducedMotion = (): boolean => prefersReducedMotion.current;

let navigatedAt = Number.NEGATIVE_INFINITY;

/** 다른 화면으로 옮겨 갈 때 부른다 (+layout.svelte onNavigate) */
export function markNavigation(): void {
	navigatedAt = performance.now();
}

/**
 * 지금 나타난 결과가 "화면을 옮겨 와서" 나타난 것인가 (옮긴 뒤 1.5초 안).
 * - 처음 들어온 화면은 서버가 이미 값을 그려 두었으므로 0부터 굴리지 않는다 (0으로 튀었다가 올라가 보인다)
 * - 같은 화면에서 입력을 바꿔 새 숫자 칸이 생긴 경우도 도착이 아니다
 *   (처음엔 "첫 화면 이후 전부"로 봤다가, 입력 중에 새로 생긴 칸까지 0부터 굴러 고쳤다)
 */
export const isClientArrival = (): boolean => performance.now() - navigatedAt < 1500;

const TYPING = 'input:not([type=checkbox]):not([type=radio]), textarea';

/** 입력칸에 글자를 넣는 중인가 — 그동안 숫자는 굴리지 않고 바로 바꾼다 (입력 흐름을 건드리지 않는다) */
export function isTyping(): boolean {
	const el = document.activeElement;
	return el instanceof HTMLElement && el.matches(TYPING);
}
