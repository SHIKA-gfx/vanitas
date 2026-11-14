import { describe, expect, it } from 'vitest';
import {
	actorLabel,
	dbErrorMessage,
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

	it('DB 오류 문장', () => {
		expect(
			dbErrorMessage({
				code: '23505',
				message: 'duplicate key value violates unique constraint "recruits_pkey"'
			})
		).toBe('같은 id의 기간이 이미 있어요');
		expect(dbErrorMessage({ code: '23505', message: '예전 id x가 지금 있는 기간 id와 같다' })).toBe(
			'예전 id x가 지금 있는 기간 id와 같다'
		);
		expect(dbErrorMessage({ code: 'PGRST202', message: 'x' })).toMatch(/supabase\/migrations/);
		expect(
			dbErrorMessage({
				code: '23505',
				message: 'duplicate key value violates unique constraint "students_game_id_key"'
			})
		).toBe('같은 게임 번호의 학생이 이미 있어요');
		expect(
			dbErrorMessage({
				code: '23503',
				message: 'update or delete on table "students" violates foreign key constraint',
				details: 'Key is still referenced from table "banner_students".'
			})
		).toBe('기간에서 쓰이고 있어 지울 수 없어요');
		expect(dbErrorMessage({ message: '알 수 없음' })).toBe('알 수 없음');
	});
});
