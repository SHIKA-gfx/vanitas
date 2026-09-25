// 게임 날짜 계산.
// 날짜는 'YYYY-MM-DD' 문자열로만 다룬다. Date 객체를 주고받으면 사용자 기기의 시간대가 끼어든다.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 지금이 게임 기준으로 며칠인가. 일일 초기화 시각 전이면 전날로 친다.
 * 예: 한국 서버 04:00 초기화 → 9월 25일 03:59는 9월 24일.
 */
export function gameToday(now: Date, resetTime = '04:00', timeZone = 'Asia/Seoul'): string {
	const [h, m] = resetTime.split(':').map(Number);
	const shifted = new Date(now.getTime() - (h * 60 + m) * 60_000);
	return new Intl.DateTimeFormat('en-CA', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(shifted);
}

export function isDateString(value: string): boolean {
	if (!DATE_RE.test(value)) return false;
	const [y, mo, d] = value.split('-').map(Number);
	const t = new Date(Date.UTC(y, mo - 1, d));
	return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
}

function toUtc(date: string): number {
	const [y, m, d] = date.split('-').map(Number);
	return Date.UTC(y, m - 1, d);
}

export function addDays(date: string, days: number): string {
	return new Date(toUtc(date) + days * 86_400_000).toISOString().slice(0, 10);
}

/** to - from (일). to가 앞이면 음수 */
export function daysBetween(from: string, to: string): number {
	return Math.round((toUtc(to) - toUtc(from)) / 86_400_000);
}
