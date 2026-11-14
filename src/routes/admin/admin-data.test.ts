import { describe, expect, it } from 'vitest';
import {
	actorLabel,
	formatKst,
	formatPeriod,
	shortList,
	signInMessage,
	tableLabel
} from './admin-data';

describe('관리자 화면 표시', () => {
	it('시각은 한국 시간 MM-DD HH:mm', () => {
		expect(formatKst('2026-11-12T15:30:00Z')).toBe('11-13 00:30');
		expect(formatKst('2026-11-12T03:05:00.123456+00:00')).toBe('11-12 12:05');
	});

	it('기간은 MM/DD ~ MM/DD', () => {
		expect(formatPeriod('2026-11-17', '2026-11-24')).toBe('11/17 ~ 11/24');
	});

	it('누가 바꿨나', () => {
		const me = '11111111-1111-1111-1111-111111111111';
		expect(actorLabel(null, me)).toBe('SQL 편집기');
		expect(actorLabel(me, me)).toBe('나');
		expect(actorLabel('22222222-2222-2222-2222-222222222222', me)).toBe('관리자 22222222');
	});

	it('표 이름과 긴 목록', () => {
		expect(tableLabel('recruit_previous_ids')).toBe('예전 id');
		expect(tableLabel('unknown')).toBe('unknown');
		expect(shortList(['a', 'b'])).toBe('a, b');
		expect(shortList(['a', 'b', 'c', 'd', 'e'])).toBe('a, b, c 외 2');
	});

	it('로그인 오류 문장', () => {
		expect(signInMessage({ message: 'Invalid login credentials', status: 400 })).toBe(
			'이메일 또는 비밀번호가 맞지 않아요'
		);
		expect(signInMessage({ message: 'x', status: 429 })).toMatch(/잠시 뒤/);
		expect(signInMessage({ message: 'Network error' })).toBe('로그인하지 못했어요: Network error');
	});
});
