import { describe, expect, it } from 'vitest';
import type { BannerType, GameConfig, RecruitPeriod, Student } from '$lib/data/types';
import scheduleJson from '../../../data/ko/schedule.json';
import studentsJson from '../../../data/ko/students.json';
import sourcesJson from '../../../data/sources.json';
import bannerTypesJson from '../../../data/ko/banner-types.json';
import gameConfigJson from '../../../data/ko/game-config.json';
import {
	addDays,
	applyRecruit,
	compareWithSite,
	draftFrom,
	draftToRecruit,
	emptyDraft,
	isDate,
	todayKst,
	validateRecruits,
	type ValidationContext
} from './recruit-edit';

const recruits = scheduleJson.recruits as unknown as RecruitPeriod[];
const ctx: ValidationContext = {
	studentIds: new Set((studentsJson.students as Student[]).map((s) => s.id)),
	sourceTier: new Map(
		Object.entries(sourcesJson.sources as Record<string, { tier: string }>).map(([k, v]) => [
			k,
			v.tier
		])
	),
	bannerAvailable: new Map(
		(bannerTypesJson.bannerTypes as unknown as BannerType[]).map((b) => [b.id, b.availableInKo])
	),
	firstStack: (gameConfigJson as unknown as GameConfig).pitySystem.schedule.find(
		(p) => p.system === 'charge'
	)!.effectiveFrom
};
const fes = recruits.find((r) => r.id === '2026-11-17-fes-5-5th')!;
const errors = (list: RecruitPeriod[]) =>
	validateRecruits(list, ctx).filter((i) => i.level === 'error');

describe('편집 칸 ↔ 기간', () => {
	it('고치지 않으면 레포의 기간과 키 순서까지 같다', () => {
		for (const r of recruits) {
			expect(JSON.stringify(draftToRecruit(draftFrom(r), r.id)), r.id).toBe(JSON.stringify(r));
		}
	});

	it('시작일을 바꾸면 id가 바뀌고 원래 id가 예전 id 끝에 붙는다', () => {
		const d = { ...draftFrom(fes), start: '2026-11-18', end: '2026-11-25' };
		const r = draftToRecruit(d, fes.id);
		expect(r.id).toBe('2026-11-18-fes-5-5th');
		expect(r.previousIds).toEqual(['2026-11-24-fes-5-5th', '2026-11-17-fes-5-5th']);
	});

	it('예전 날짜로 되돌리면 그 id는 예전 id에서 빠진다', () => {
		const d = { ...draftFrom(fes), start: '2026-11-24', end: '2026-12-01' };
		const r = draftToRecruit(d, fes.id);
		expect(r.id).toBe('2026-11-24-fes-5-5th');
		expect(r.previousIds).toEqual(['2026-11-17-fes-5-5th']);
	});

	it('빈 칸은 키를 뺀다', () => {
		const r = draftToRecruit({ ...draftFrom(fes), event: '  ', note: '', offPickup: [] }, fes.id);
		expect('event' in r || 'note' in r || 'offPickup' in r).toBe(false);
	});

	it('새 기간은 마지막 기간이 끝나는 날부터 7일', () => {
		const last = recruits.at(-1)!;
		const d = emptyDraft(recruits, '2026-11-14');
		expect(d.start).toBe(last.end);
		expect(d.end).toBe(addDays(last.end, 7));
		expect(emptyDraft([], '2026-11-14').start).toBe('2026-11-14');
	});

	it('목록에 넣으면 시작일 순', () => {
		const r = draftToRecruit({ ...emptyDraft(recruits, ''), start: '2026-12-01', slug: 'x' }, null);
		const list = applyRecruit(recruits, null, r);
		expect(list.map((x) => x.start)).toEqual([...list.map((x) => x.start)].sort());
		expect(applyRecruit(recruits, fes.id, null)).toHaveLength(recruits.length - 1);
	});
});

describe('저장 전 검사 (validate.py check_recruits)', () => {
	it('레포 데이터는 오류가 없고, 출처 하나뿐인 추정 기간은 경고', () => {
		const issues = validateRecruits(recruits, ctx);
		expect(issues.filter((i) => i.level === 'error')).toEqual([]);
		expect(issues.filter((i) => i.level === 'warning').length).toBeGreaterThan(0);
	});

	it('공지 기간에 공식 출처가 없으면 오류', () => {
		const r = { ...fes, sources: ['31'] };
		expect(errors(applyRecruit(recruits, fes.id, r)).map((i) => i.message)).toContain(
			'공지된 기간에는 공식 출처가 하나 있어야 해요'
		);
	});

	it('이름·날짜·배너·학생', () => {
		const d = { ...draftFrom(fes), slug: 'Fes 5', end: fes.start };
		d.banners = [{ type: 'encore', students: [] }];
		d.offPickup = ['nobody'];
		const messages = errors(applyRecruit(recruits, fes.id, draftToRecruit(d, fes.id))).map(
			(i) => i.message
		);
		expect(messages).toEqual(
			expect.arrayContaining([
				'id 뒷부분(이름)은 영어 소문자·숫자·하이픈(-)으로 적어요',
				'종료일은 시작일보다 늦어야 해요',
				'배너 1: 한국 서버에서 운영하지 않는 배너 종류예요',
				'배너 1: 픽업 학생이 없어요',
				"픽업 외: 없는 학생 'nobody'"
			])
		);
	});

	it('스택 전환 이전, 추정 뒤 공지, 픽업과 픽업 외 겹침', () => {
		const early = draftToRecruit(
			{ ...draftFrom(fes), start: '2026-11-03', end: '2026-11-10' },
			fes.id
		);
		expect(
			errors(applyRecruit(recruits, fes.id, early)).some((i) => i.message.includes('이전 기간'))
		).toBe(true);
		const late = {
			...fes,
			id: '2027-03-02-x',
			start: '2027-03-02',
			end: '2027-03-09',
			previousIds: undefined
		};
		expect(
			errors(applyRecruit(recruits, null, late)).some((i) => i.message.includes('추정 기간보다 뒤'))
		).toBe(true);
		const both = { ...fes, offPickup: [fes.banners[0].students[0]] };
		expect(
			errors(applyRecruit(recruits, fes.id, both)).some((i) => i.message.includes('함께 있어요'))
		).toBe(true);
	});

	it('예전 id: 다른 기간 id와 같음 / 두 기간이 같은 예전 id', () => {
		const other = recruits.find((r) => r.status === 'estimated')!;
		const clash = { ...fes, previousIds: [other.id] };
		expect(
			errors(applyRecruit(recruits, fes.id, clash)).some((i) =>
				i.message.includes('지금 있는 기간 id')
			)
		).toBe(true);
		const shared = { ...fes, previousIds: [...(other.previousIds ?? [])] };
		expect(
			errors(applyRecruit(recruits, fes.id, shared)).some((i) =>
				i.message.includes('도 갖고 있어요')
			)
		).toBe(true);
	});
});

describe('사이트 반영 상태', () => {
	it('같음 / 바뀜 / 새 기간 / 지운 기간 — 키 순서는 보지 않는다', () => {
		const reordered = Object.fromEntries(Object.entries(fes).reverse()) as unknown as RecruitPeriod;
		const changed = { ...recruits[0], note: '바뀜' };
		const added = { ...fes, id: '2027-03-02-x' };
		const db = [changed, reordered, added];
		const sync = compareWithSite(db, recruits);
		expect(sync.byId.get(changed.id)).toBe('changed');
		expect(sync.byId.get(fes.id)).toBe('same');
		expect(sync.byId.get(added.id)).toBe('new');
		expect(sync.removed).toHaveLength(recruits.length - 2);
	});
});

describe('날짜', () => {
	it('형식과 실제 날짜, 한국 날짜', () => {
		expect(isDate('2026-11-31')).toBe(false);
		expect(isDate('2026-11-30')).toBe(true);
		expect(addDays('2026-12-29', 7)).toBe('2027-01-05');
		expect(todayKst(new Date('2026-11-14T16:00:00Z'))).toBe('2026-11-15');
	});
});
