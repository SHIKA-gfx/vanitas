import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, gameToday, isDateString } from './game-date';

describe('gameToday', () => {
	it('초기화 시각 전이면 전날', () => {
		expect(gameToday(new Date('2026-09-25T03:59:00+09:00'))).toBe('2026-09-24');
		expect(gameToday(new Date('2026-09-25T04:00:00+09:00'))).toBe('2026-09-25');
	});
	it('기기 시간대와 무관하게 한국 시간 기준', () => {
		// UTC 2026-09-24 19:30 = KST 09-25 04:30
		expect(gameToday(new Date('2026-09-24T19:30:00Z'))).toBe('2026-09-25');
	});
});

describe('날짜 계산', () => {
	it('월·해 넘김', () => {
		expect(addDays('2026-09-25', 7)).toBe('2026-10-02');
		expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
		expect(daysBetween('2026-09-25', '2027-04-27')).toBe(214);
		expect(daysBetween('2026-09-25', '2026-09-24')).toBe(-1);
	});
	it('형식 검사', () => {
		expect(isDateString('2026-02-29')).toBe(false);
		expect(isDateString('2028-02-29')).toBe(true);
		expect(isDateString('2026-9-25')).toBe(false);
	});
});
