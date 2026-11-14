import { describe, expect, it } from 'vitest';
import type { SourceEntry } from '$lib/data/db/convert';
import type { RecruitPeriod, Student } from '$lib/data/types';
import scheduleJson from '../../../data/ko/schedule.json';
import studentsJson from '../../../data/ko/students.json';
import sourcesJson from '../../../data/sources.json';
import {
	countUsage,
	draftToSource,
	draftToStudent,
	emptySourceDraft,
	emptyStudentDraft,
	nextSourceId,
	sourceDraftFrom,
	studentDraftFrom,
	validateSource,
	validateStudent
} from './catalog-edit';

const students = studentsJson.students as Student[];
const sources = sourcesJson.sources as unknown as Record<string, SourceEntry>;
const recruits = scheduleJson.recruits as unknown as RecruitPeriod[];
const errorFields = (issues: { level: string; field?: string }[]) =>
	issues.filter((i) => i.level === 'error').map((i) => i.field);

describe('학생', () => {
	it('고치지 않으면 students.json의 한 줄과 키 순서까지 같다', () => {
		for (const s of students) {
			expect(JSON.stringify(draftToStudent(studentDraftFrom(s))), s.id).toBe(JSON.stringify(s));
		}
	});

	it('레포 학생은 오류가 없다', () => {
		for (const s of students) {
			const others = students.filter((o) => o.id !== s.id);
			expect(errorFields(validateStudent(studentDraftFrom(s), others, false)), s.id).toEqual([]);
		}
	});

	it('새 학생: id 규칙·겹침, 게임 번호 겹침, 한국어 이름', () => {
		const taken = students[0];
		const d = { ...emptyStudentDraft(), id: 'Bad Id', gameId: taken.gameId };
		expect(errorFields(validateStudent(d, students, true))).toEqual(['id', 'gameId', 'ko']);
		const dup = { ...emptyStudentDraft(), id: taken.id, gameId: 99999, ko: '새 학생' };
		expect(errorFields(validateStudent(dup, students, true))).toEqual(['id']);
	});

	it('괄호: 한국어 반각, 일본어 전각, 앞 공백 없음, 짝', () => {
		const base = { ...emptyStudentDraft(), id: 'new_one', gameId: 99999 };
		expect(errorFields(validateStudent({ ...base, ko: '호시노（무장）' }, students, true))).toEqual(
			['ko']
		);
		expect(errorFields(validateStudent({ ...base, ko: '호시노 (무장)' }, students, true))).toEqual([
			'ko'
		]);
		expect(errorFields(validateStudent({ ...base, ko: '호시노(무장' }, students, true))).toEqual([
			'ko'
		]);
		expect(
			errorFields(
				validateStudent({ ...base, ko: '호시노(무장)', ja: 'ホシノ(臨戦)' }, students, true)
			)
		).toEqual(['ja']);
		expect(
			errorFields(
				validateStudent({ ...base, ko: '호시노(무장)', ja: 'ホシノ（臨戦）' }, students, true)
			)
		).toEqual([]);
	});

	it('가칭인데 일본 이름이 없으면 경고, 빈 일본 이름은 null', () => {
		const d = { ...emptyStudentDraft(), id: 'new_one', gameId: 99999, ko: '새', ja: '  ' };
		const issues = validateStudent(d, students, true);
		expect(issues).toEqual([expect.objectContaining({ level: 'warning', field: 'ja' })]);
		expect(draftToStudent(d).name.ja).toBeNull();
	});
});

describe('출처', () => {
	it('고치지 않으면 sources.json의 한 건과 같다 (키 순서는 publisher, title, date, url, retrievedAt, tier, note)', () => {
		for (const [id, s] of Object.entries(sources)) {
			const back = draftToSource(sourceDraftFrom(s));
			expect(back, id).toEqual(s);
			expect(Object.keys(back), id).toEqual(
				['publisher', 'title', 'date', 'url', 'retrievedAt', 'tier', 'note'].filter(
					(k) => k in back
				)
			);
		}
	});

	it('레포 출처는 오류가 없다 (주소 없는 출처는 경고)', () => {
		for (const [id, s] of Object.entries(sources)) {
			const issues = validateSource(sourceDraftFrom(s));
			expect(errorFields(issues), id).toEqual([]);
			expect(
				issues.some((i) => i.level === 'warning'),
				id
			).toBe(s.url === null);
		}
	});

	it('필수 칸, 날짜 세 형식, 주소, 확인한 날', () => {
		const bad = {
			...emptySourceDraft('2026-11-14'),
			date: '2026-13',
			url: 'forum.nexon.com',
			retrievedAt: '2026-02-30'
		};
		expect(errorFields(validateSource(bad))).toEqual([
			'publisher',
			'title',
			'date',
			'url',
			'retrievedAt'
		]);
		const ok = {
			...bad,
			publisher: '넥슨',
			title: '공지',
			url: 'https://forum.nexon.com/x',
			retrievedAt: ''
		};
		for (const date of ['2026', '2026-11', '2026-11-16', '']) {
			expect(errorFields(validateSource({ ...ok, date })), date).toEqual([]);
		}
		expect('retrievedAt' in draftToSource(ok)).toBe(false);
	});

	it('다음 번호', () => {
		expect(nextSourceId(Object.keys(sources))).toBe(
			String(Math.max(...Object.keys(sources).map(Number)) + 1)
		);
		expect(nextSourceId([])).toBe('1');
	});
});

describe('쓰임', () => {
	it('학생은 픽업·픽업 외, 출처는 기간 출처', () => {
		const usage = countUsage(recruits);
		const fes = recruits.find((r) => r.offPickup?.length)!;
		expect(usage.students.get(fes.offPickup![0])).toContain(fes.id);
		expect(usage.students.get(fes.banners[0].students[0])).toContain(fes.id);
		expect(usage.sources.get(fes.sources[0])).toContain(fes.id);
		const used = new Set(
			recruits.flatMap((r) => [...r.banners.flatMap((b) => b.students), ...(r.offPickup ?? [])])
		);
		expect(usage.students.size).toBe(used.size);
	});
});
