import { readdirSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { RecruitPeriod } from '../types';
import type { DataFiles } from './convert';
import { filesToRows, recruitToRows, rowsToFiles, rowsToRecruits, rowsToSources } from './convert';
import { TABLED_KEYS } from './rows';

/** 레포 data/*.json 전부 (테스트는 레포 루트에서 돈다) */
function repoFiles(): DataFiles {
	const files: DataFiles = {};
	for (const name of readdirSync('data', { recursive: true }) as string[]) {
		if (!name.endsWith('.json')) continue;
		files[name.split(sep).join('/')] = JSON.parse(readFileSync(join('data', name), 'utf8'));
	}
	return files;
}

const recruit = (over: Partial<RecruitPeriod> = {}): RecruitPeriod => ({
	id: '2026-12-01-test',
	start: '2026-12-01',
	end: '2026-12-08',
	status: 'estimated',
	banners: [{ type: 'pickup_normal', students: ['a', 'b'] }],
	sources: ['31'],
	...over
});

describe('레포 데이터 왕복 (docs/006 7-2)', () => {
	const files = repoFiles();
	const rows = filesToRows(files);
	const back = rowsToFiles(rows);

	it('파일 → 행 → 파일: 모든 파일의 값이 같다', () => {
		expect(Object.keys(back).sort()).toEqual(Object.keys(files).sort());
		for (const path of Object.keys(files)) expect(back[path], path).toEqual(files[path]);
	});

	it('한 번 돌린 결과는 다시 돌려도 키 순서까지 같다', () => {
		const again = rowsToFiles(filesToRows(back));
		for (const path of Object.keys(back)) {
			expect(JSON.stringify(again[path]), path).toBe(JSON.stringify(back[path]));
		}
	});

	it('표로 뺀 배열 자리에는 자리 표시가 남고 키 순서는 그대로다', () => {
		for (const [path, { key, table }] of Object.entries(TABLED_KEYS)) {
			const doc = rows.datasets.find((d) => d.path === path);
			expect(doc?.data[key], path).toEqual({ $table: table });
			expect(Object.keys(doc?.data ?? {}), path).toEqual(Object.keys(files[path]));
		}
	});

	it('정식 표의 행 수가 파일과 맞는다', () => {
		const schedule = files['ko/schedule.json'] as { recruits: RecruitPeriod[] };
		expect(rows.recruits).toHaveLength(schedule.recruits.length);
		expect(rows.recruit_banners).toHaveLength(schedule.recruits.flatMap((r) => r.banners).length);
		expect(rows.recruit_previous_ids).toHaveLength(
			schedule.recruits.flatMap((r) => r.previousIds ?? []).length
		);
		expect(rows.students).toHaveLength((files['ko/students.json'].students as unknown[]).length);
		expect(rows.sources).toHaveLength(Object.keys(files['sources.json'].sources as object).length);
		expect(rows.datasets).toHaveLength(Object.keys(files).length);
	});
});

describe('픽업 기간', () => {
	it('키 순서는 id, start, end, status, event, freePulls, previousIds, banners, offPickup, sources, note', () => {
		const full = recruit({
			note: '메모',
			sources: ['31'],
			offPickup: ['c'],
			banners: [{ type: 'fes', students: ['a'] }],
			previousIds: ['2026-12-08-test'],
			freePulls: 200,
			event: '이벤트'
		});
		const [back] = rowsToRecruits(rowsOf([full]));
		expect(Object.keys(back)).toEqual([
			'id',
			'start',
			'end',
			'status',
			'event',
			'freePulls',
			'previousIds',
			'banners',
			'offPickup',
			'sources',
			'note'
		]);
	});

	it('빈 칸은 키를 뺀다 — 빈 previousIds·offPickup도', () => {
		const [back] = rowsToRecruits(rowsOf([recruit({ previousIds: [], offPickup: [] })]));
		expect(back).toEqual(recruit());
		expect('previousIds' in back || 'offPickup' in back || 'event' in back).toBe(false);
	});

	it('배너·학생·예전 id의 순서가 남는다', () => {
		const r = recruit({
			previousIds: ['2026-12-15-test', '2026-12-08-test'],
			banners: [
				{ type: 'fes', students: ['z', 'a'] },
				{ type: 'pickup_normal', students: ['m'] }
			]
		});
		const rows = recruitToRows(r);
		expect(rows.bannerStudents.map((s) => [s.banner_seq, s.seq, s.student_id])).toEqual([
			[1, 1, 'z'],
			[1, 2, 'a'],
			[2, 1, 'm']
		]);
		expect(rowsToRecruits(rowsOf([r]))[0]).toEqual(r);
	});

	it('순서는 시작일, 같으면 id', () => {
		const list = [
			recruit({ id: '2026-12-08-b', start: '2026-12-08' }),
			recruit({ id: '2026-12-01-b' }),
			recruit({ id: '2026-12-01-a' })
		];
		expect(rowsToRecruits(rowsOf(list)).map((r) => r.id)).toEqual([
			'2026-12-01-a',
			'2026-12-01-b',
			'2026-12-08-b'
		]);
	});

	it('표에 없는 칸이 있으면 멈춘다 (조용히 버리지 않는다)', () => {
		const odd = { ...recruit(), newField: 1 } as RecruitPeriod;
		expect(() => recruitToRows(odd)).toThrow(/표에 없는 칸 'newField'/);
		const oddBanner = recruit({ banners: [{ type: 'fes', students: [], x: 1 } as never] });
		expect(() => recruitToRows(oddBanner)).toThrow(/배너 1에 표에 없는 칸 'x'/);
	});

	it('없는 기간을 가리키는 행이면 멈춘다', () => {
		const rows = rowsOf([recruit()]);
		rows.recruit_banners.push({ recruit_id: '2027-01-01-ghost', seq: 1, type: 'fes' });
		expect(() => rowsToRecruits(rows)).toThrow(/없는 기간 2027-01-01-ghost/);
	});
});

describe('출처', () => {
	it('date·url은 null이어도 쓰고 retrievedAt·note는 null이면 뺀다, id는 숫자 순', () => {
		const out = rowsToSources([
			{ id: '10', publisher: 'p', title: 't', published: null, url: null, retrieved_at: null, tier: 'community', note: null },
			{ id: '9', publisher: 'p', title: 't', published: '2026', url: 'https://x', retrieved_at: '2026-11-10', tier: 'official', note: 'n' }
		]);
		expect(Object.keys(out)).toEqual(['9', '10']);
		expect(Object.keys(out['9'])).toEqual(['publisher', 'title', 'date', 'url', 'retrievedAt', 'tier', 'note']);
		expect(out['10']).toEqual({ publisher: 'p', title: 't', date: null, url: null, tier: 'community' });
	});
});

describe('파일 전체', () => {
	it('자리 표시가 없으면 멈춘다', () => {
		const rows = filesToRows(repoFiles());
		const schedule = rows.datasets.find((d) => d.path === 'ko/schedule.json');
		if (schedule) schedule.data = { ...schedule.data, recruits: [] };
		expect(() => rowsToFiles(rows)).toThrow(/자리에 \{"\$table": "recruits"\} 표시가 없다/);
	});

	it('표로 빼는 파일이 없으면 멈춘다', () => {
		const files = repoFiles();
		delete files['ko/students.json'];
		expect(() => filesToRows(files)).toThrow(/ko\/students.json가 없다/);
	});
});

function rowsOf(list: RecruitPeriod[]) {
	const rows = filesToRows({
		'ko/schedule.json': { recruits: list },
		'ko/students.json': { students: [] },
		'sources.json': { sources: {} }
	});
	return rows;
}
