/**
 * 화면에 나가는 숫자 서식. 모든 계산기가 공용으로 쓴다.
 *
 * 메시지 파일에는 서식을 넣지 않는다. 숫자는 여기서 문자열로 만든 뒤
 * m.키({ count: formatInt(n) })처럼 넘긴다. 로케일마다 쉼표·소수점 규칙이 달라서다.
 */
import { getLocale } from '$lib/paraglide/runtime.js';

/** 정수 — 청휘석, 연차, 포인트 (24,000) */
export function formatInt(n: number): string {
	return new Intl.NumberFormat(getLocale(), { maximumFractionDigits: 0 }).format(n);
}

/** 누적 확률 — 0~1을 받아 소수 1자리 퍼센트로 (75.5%) */
export function formatPercent(p: number): string {
	return new Intl.NumberFormat(getLocale(), {
		style: 'percent',
		minimumFractionDigits: 1,
		maximumFractionDigits: 1
	}).format(p);
}

/**
 * 1회 확률처럼 작은 값 — 0~1을 받아 유효숫자 3자리 퍼센트로.
 * 0.7% / 0.0275% 가 모두 읽히도록 자릿수를 고정하지 않는다.
 */
export function formatRate(p: number): string {
	return new Intl.NumberFormat(getLocale(), {
		style: 'percent',
		maximumSignificantDigits: 3
	}).format(p);
}
