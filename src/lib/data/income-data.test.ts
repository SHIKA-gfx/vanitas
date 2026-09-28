// index.ts의 수급원·일정표 조회 함수 테스트. index.test.ts에 합쳐도 된다.
import { describe, expect, it } from 'vitest';
import { getIncomeSources, listEvents, listIncomePresets, listRaidSeasons } from './index';

describe('수급원', () => {
	it('프리셋은 메모 키(_comment)를 빼고 파일 순서대로', () => {
		expect(listIncomePresets().map((p) => p.id)).toEqual(['full', 'major', 'loginOnly']);
	});

	it('프리셋은 무료 수급원만 가리킨다', () => {
		const ids = new Set(getIncomeSources().sources.map((s) => s.id));
		for (const p of listIncomePresets()) for (const id of p.include) expect(ids.has(id)).toBe(true);
	});
});

describe('레이드 시즌', () => {
	it('목록 안은 그대로, 목록이 끝나면 28일 주기로 이어 붙인다', () => {
		const seasons = listRaidSeasons('grandAssault', '2027-03-31');
		const last = seasons.filter((s) => !s.projected).at(-1);
		expect(last).toMatchObject({ season: 37, start: '2027-01-05' });

		const projected = seasons.filter((s) => s.projected);
		expect(projected.map((s) => [s.season, s.start, s.end])).toEqual([
			[38, '2027-02-02', '2027-02-09'],
			[39, '2027-03-02', '2027-03-09'],
			[40, '2027-03-30', '2027-04-06']
		]);
		expect(projected.every((s) => s.status === 'estimated')).toBe(true);
	});

	it('until 뒤에 시작하는 시즌은 뺀다', () => {
		const seasons = listRaidSeasons('totalAssault', '2026-09-30');
		expect(seasons.at(-1)?.season).toBe(86);
		expect(seasons.some((s) => s.projected)).toBe(false);
	});
});

describe('이벤트', () => {
	it('시작일 순서, 목록 밖은 추정하지 않는다', () => {
		const events = listEvents();
		const starts = events.map((e) => e.start);
		expect(starts).toEqual([...starts].sort());
		expect(events.at(-1)?.end).toBe('2027-01-26');
	});
});
