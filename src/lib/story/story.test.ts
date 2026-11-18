import { describe, expect, it } from 'vitest';
import { storyDoc } from './data';
import {
	EMPTY_SAVE,
	mainBefore,
	mainProgress,
	normalizeSave,
	orderUnits,
	readAfterOf,
	readSet,
	splitByProgress,
	visibleEntries,
	visibleEntry,
	volumesWithChapters,
	type StorySave
} from './story';
import type { EventUnit, MainUnit, StoryDoc, StoryEntry } from './types';

// ------------------------------------------------------------ 작은 고정 데이터 (실제 게임 정보가 아니다)

const unit = {
	releasedKr: '',
	chronoKey: 0,
	chronoCertainty: 'unknown',
	chronoNote: '',
	chronoSources: [],
	replayable: 'unknown',
	sources: [],
	verified: true
} as const;
const main = (
	id: string,
	volume: string,
	chapter: number,
	more: Partial<MainUnit> = {}
): MainUnit => ({
	...unit,
	chronoSources: [],
	sources: [],
	id,
	title: id,
	volume,
	chapter,
	...more
});
const event = (id: string, more: Partial<EventUnit> = {}): EventUnit => ({
	...unit,
	chronoSources: [],
	sources: [],
	id,
	title: id,
	readAfter: [],
	readAfterSources: [],
	...more
});
const entry = (
	id: string,
	blocks: [string, string, string][],
	related: string[] = []
): StoryEntry => ({
	id,
	entryType: 'person',
	blocks: blocks.map(([after, name, text]) => ({ after, name, text })),
	related,
	sources: [],
	verified: true
});

const doc: StoryDoc = {
	meta: { description: '', verifiedAt: '', sources: [] },
	volumes: [
		{ id: 'v1', title: '1권', sources: [], verified: true },
		{ id: 'v2', title: '2권', sources: [], verified: true },
		{ id: 'v9', title: '장 없는 권', sources: [], verified: true }
	],
	main: [
		main('m1', 'v1', 1, { releasedKr: '2021-01-01', chronoKey: 100, chronoCertainty: 'stated' }),
		main('m2', 'v1', 2, { releasedKr: '2021-03-01', chronoKey: 300, chronoCertainty: 'inferred' }),
		main('m3', 'v2', 1, { releasedKr: '2021-06-01', chronoKey: 500, chronoCertainty: 'stated' }),
		main('m4', 'v2', 2)
	],
	events: [
		event('e1', {
			releasedKr: '2021-02-01',
			chronoKey: 200,
			chronoCertainty: 'inferred',
			readAfter: ['m1', 'gone']
		}),
		event('e2', { releasedKr: '2021-03-01', chronoKey: 600, chronoCertainty: 'stated' }),
		event('e3')
	],
	entries: [
		entry(
			'masked',
			[
				['m1', '가면 쓴 인물', '처음 모습'],
				['m3', '', '2권에서 더 알게 됨'],
				['e2', '본명', '이벤트에서 정체가 밝혀짐']
			],
			['club', 'later', 'masked']
		),
		entry('club', [['m2', '동아리', '설명']], ['masked']),
		entry('later', [['m4', '나중 인물', '설명']], ['masked']),
		entry('event-only', [['e1', '이벤트 인물', '설명']])
	]
};

const save = (mainUpTo: string | null, readEvents: string[] = []): StorySave => ({
	mainUpTo,
	readEvents,
	order: 'release'
});

describe('읽은 단위 집합', () => {
	it('메인은 포인터까지 목록 순서대로 전부, 이벤트는 체크한 것만', () => {
		expect([...readSet(doc, save('m2', ['e2']))].sort()).toEqual(['e2', 'm1', 'm2']);
		expect(readSet(doc, save(null)).size).toBe(0);
	});

	it('데이터에 없는 id는 읽은 것으로 치지 않는다 (진행도를 지어내지 않는다)', () => {
		expect(readSet(doc, save('gone', ['e9', 'm3'])).size).toBe(0);
	});

	it('저장값 정리: 없는 id는 빼고, 이벤트는 겹치지 않게 목록 순서로', () => {
		expect(
			normalizeSave(doc, { mainUpTo: 'gone', readEvents: ['e3', 'x', 'e1', 'e3'], order: 'chrono' })
		).toEqual({ mainUpTo: null, readEvents: ['e1', 'e3'], order: 'chrono' });
		expect(normalizeSave(doc, save('m3'))).toEqual(save('m3'));
	});
});

describe('사전 — 읽은 만큼만', () => {
	it('첫 블록의 스토리를 읽기 전에는 목록에도 없다', () => {
		const read = readSet(doc, save(null, ['e2']));
		// e2 블록은 읽었지만 첫 블록(m1)을 안 읽음 → 항목 자체가 없다
		expect(visibleEntry(doc.entries[0], read)).toBeNull();
		expect(visibleEntries(doc, read)).toEqual([]);
	});

	it('블록은 각자의 스토리를 읽었으면 보인다 — 순서 없이 읽는 이벤트도', () => {
		const read = readSet(doc, save('m1', ['e2']));
		// m3 블록은 안 읽어서 빠지고, e2 블록은 보인다
		expect(visibleEntry(doc.entries[0], read)).toEqual({
			id: 'masked',
			entryType: 'person',
			name: '본명',
			texts: ['처음 모습', '이벤트에서 정체가 밝혀짐']
		});
	});

	it('이름은 보이는 블록 중 마지막으로 이름이 적힌 것 (빈 이름은 그대로)', () => {
		const read = readSet(doc, save('m3'));
		const v = visibleEntry(doc.entries[0], read)!;
		expect(v.name).toBe('가면 쓴 인물');
		expect(v.texts).toEqual(['처음 모습', '2권에서 더 알게 됨']);
	});

	it('숨은 블록 수는 돌려주지 않는다 (결정 D6)', () => {
		const v = visibleEntry(doc.entries[0], readSet(doc, save('m1')))!;
		expect(Object.keys(v).sort()).toEqual(['entryType', 'id', 'name', 'texts']);
	});

	it('관련 항목은 상대도 보일 때만, 상대의 지금 이름으로. 자기 자신은 빼고', () => {
		const early = visibleEntries(doc, readSet(doc, save('m2')));
		expect(early.map((e) => e.id)).toEqual(['masked', 'club']);
		expect(early[0].related).toEqual([{ id: 'club', name: '동아리' }]);
		expect(early[1].related).toEqual([{ id: 'masked', name: '가면 쓴 인물' }]);

		const late = visibleEntries(doc, readSet(doc, save('m4', ['e2'])));
		expect(late.find((e) => e.id === 'club')!.related).toEqual([{ id: 'masked', name: '본명' }]);
		expect(late[0].related.map((r) => r.id)).toEqual(['club', 'later']);
	});
});

describe('읽는 순서', () => {
	it('공개순: 공개일, 같은 날이면 메인이 먼저. 공개일을 모르면 따로', () => {
		const { ordered, unknown } = orderUnits(doc, 'release');
		expect(ordered.map((u) => u.id)).toEqual(['m1', 'e1', 'm2', 'e2', 'm3']);
		expect(unknown.map((u) => u.id)).toEqual(['m4', 'e3']);
	});

	it('작중순: 작중 순서 키. 모르면(unknown) 따로', () => {
		const { ordered, unknown } = orderUnits(doc, 'chrono');
		expect(ordered.map((u) => u.id)).toEqual(['m1', 'e1', 'm2', 'm3', 'e2']);
		expect(unknown.map((u) => u.id)).toEqual(['m4', 'e3']);
	});

	it('먼저 읽으면 좋아요: 이름과 읽었는지, 없는 id는 뺀다. 메인은 없다', () => {
		const read = readSet(doc, save('m1'));
		expect(readAfterOf(doc, doc.events[0], read)).toEqual([{ id: 'm1', title: 'm1', read: true }]);
		expect(readAfterOf(doc, doc.main[1], read)).toEqual([]);
	});
});

describe('읽는 순서 접기', () => {
	const split = (s: StorySave, by: 'release' | 'chrono' = 'release') => {
		const r = splitByProgress(orderUnits(doc, by).ordered, readSet(doc, s));
		return {
			past: r.past.map((u) => u.id),
			ahead: r.ahead.map((u) => u.id),
			n: r.pastUnseenEvents
		};
	};

	it('본 메인 장이 없으면 접지 않는다 (이벤트만 봤어도)', () => {
		expect(split(save(null, ['e1']))).toEqual({
			past: [],
			ahead: ['m1', 'e1', 'm2', 'e2', 'm3'],
			n: 0
		});
	});

	it('가장 뒤의 본 메인 장까지 접고, 그 앞의 안 본 이벤트를 센다', () => {
		expect(split(save('m2'))).toEqual({ past: ['m1', 'e1', 'm2'], ahead: ['e2', 'm3'], n: 1 });
		expect(split(save('m2', ['e1'])).n).toBe(0);
	});

	it('기준 뒤의 이벤트는 봤다고 해도 접지 않는다', () => {
		expect(split(save('m2', ['e2']))).toEqual({
			past: ['m1', 'e1', 'm2'],
			ahead: ['e2', 'm3'],
			n: 1
		});
	});

	it('정렬마다 기준 자리가 다르다', () => {
		// 공개순 m1 e1 m2 e2 m3 / 작중순 m1 e1 m2 m3 e2
		expect(split(save('m3'), 'release').past).toEqual(['m1', 'e1', 'm2', 'e2', 'm3']);
		expect(split(save('m3'), 'chrono')).toEqual({
			past: ['m1', 'e1', 'm2', 'm3'],
			ahead: ['e2'],
			n: 1
		});
	});

	it('안 본 메인 장은 기준보다 앞에 놓여 있어도 접지 않는다 (읽는 순서 ≠ 공개순)', () => {
		// 읽는 순서 a1 → b1 → a2, 공개는 a1 → x → a2 → b1
		const d: StoryDoc = {
			...doc,
			main: [
				main('a1', 'v1', 1, { releasedKr: '2021-01-01' }),
				main('b1', 'v2', 1, { releasedKr: '2021-05-01' }),
				main('a2', 'v1', 2, { releasedKr: '2021-03-01' })
			],
			events: [event('x', { releasedKr: '2021-02-01' })],
			entries: []
		};
		const r = splitByProgress(orderUnits(d, 'release').ordered, readSet(d, save('b1')));
		expect(r.past.map((u) => u.id)).toEqual(['a1', 'x', 'b1']);
		expect(r.ahead.map((u) => u.id)).toEqual(['a2']);
		expect(r.pastUnseenEvents).toBe(1);
	});

	it('메인 장의 봤어요를 풀면 바로 앞 장까지로 (첫 장·없는 id는 아직 안 봄)', () => {
		expect(mainBefore(doc, 'm3')).toBe('m2');
		expect(mainBefore(doc, 'm1')).toBeNull();
		expect(mainBefore(doc, 'gone')).toBeNull();
	});
});

describe('진행도 고르기', () => {
	it('권마다 장, 장 없는 권은 뺀다', () => {
		expect(volumesWithChapters(doc).map((v) => [v.volume.id, v.chapters.map((c) => c.id)])).toEqual(
			[
				['v1', ['m1', 'm2']],
				['v2', ['m3', 'm4']]
			]
		);
	});

	it('같은 권의 장이 목록에서 떨어져 있어도 — 권 안 장 순서대로 고르고, 읽음은 목록 순서로 센다', () => {
		// 읽는 순서: 1권 1장 → 2권 1장 → 1권 2장 (실제로 1부 Vol.1 3장은 Final 뒤에 읽는다)
		const split: StoryDoc = {
			...doc,
			main: [main('a1', 'v1', 1), main('b1', 'v2', 1), main('a2', 'v1', 2)],
			events: [],
			entries: []
		};
		expect(
			volumesWithChapters(split).map((v) => [v.volume.id, v.chapters.map((c) => c.id)])
		).toEqual([
			['v1', ['a1', 'a2']],
			['v2', ['b1']]
		]);
		expect([...readSet(split, save('a2'))].sort()).toEqual(['a1', 'a2', 'b1']);
		expect([...readSet(split, save('a1'))]).toEqual(['a1']);
		expect(mainProgress(split, save('a2'))).toEqual({ read: 3, total: 3 });
	});

	it('몇 장까지 봤는지', () => {
		expect(mainProgress(doc, save('m3'))).toEqual({ read: 3, total: 4 });
		expect(mainProgress(doc, EMPTY_SAVE)).toEqual({ read: 0, total: 4 });
	});
});

// ------------------------------------------------------------ 실제 데이터 (data/ko/story.json 스냅샷)

describe('실제 데이터', () => {
	it('정렬은 모든 단위를 한 번씩 나눠 담는다', () => {
		const ids = [...storyDoc.main, ...storyDoc.events].map((u) => u.id).sort();
		for (const by of ['release', 'chrono'] as const) {
			const { ordered, unknown } = orderUnits(storyDoc, by);
			expect([...ordered, ...unknown].map((u) => u.id).sort()).toEqual(ids);
		}
	});

	it('아무것도 안 봤으면 사전이 비어 있고, 메인 끝까지 + 이벤트 전부면 모든 항목이 보인다', () => {
		expect(visibleEntries(storyDoc, readSet(storyDoc, EMPTY_SAVE))).toEqual([]);
		const all: StorySave = {
			mainUpTo: storyDoc.main.at(-1)?.id ?? null,
			readEvents: storyDoc.events.map((u) => u.id),
			order: 'release'
		};
		const shown = visibleEntries(storyDoc, readSet(storyDoc, all));
		expect(shown.map((e) => e.id)).toEqual(storyDoc.entries.map((e) => e.id));
		for (const e of shown) expect(e.name.trim(), e.id).not.toBe('');
	});

	it('접기: 어느 장까지 봤든 두 쪽을 합치면 목록 전체, 접힌 쪽에 안 본 메인 장이 없다', () => {
		for (const by of ['release', 'chrono'] as const) {
			const { ordered } = orderUnits(storyDoc, by);
			for (const upTo of [null, ...storyDoc.main.map((u) => u.id)]) {
				const read = readSet(storyDoc, { ...EMPTY_SAVE, mainUpTo: upTo });
				const { past, ahead, pastUnseenEvents } = splitByProgress(ordered, read);
				const tag = `${by} ${upTo}`;
				expect([...past, ...ahead].map((u) => u.id).sort(), tag).toEqual(
					ordered.map((u) => u.id).sort()
				);
				expect(
					past.filter((u) => 'chapter' in u && !read.has(u.id)),
					tag
				).toEqual([]);
				expect(
					ahead.filter((u) => 'chapter' in u && read.has(u.id)),
					tag
				).toEqual([]);
				expect(pastUnseenEvents, tag).toBe(past.filter((u) => !('chapter' in u)).length);
			}
		}
	});

	it('진행도 고르기의 장을 모두 합치면 메인 전체 (권이 없는 장이 없다)', () => {
		const chapters = volumesWithChapters(storyDoc).flatMap((v) => v.chapters);
		expect(chapters.length).toBe(storyDoc.main.length);
	});
});
