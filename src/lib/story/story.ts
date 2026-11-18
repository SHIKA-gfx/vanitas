/**
 * 스토리 길잡이 계산 (docs/008 8장) — 순수 함수. 화면(src/routes/extra/story)과 테스트가 쓴다.
 *
 * 무엇을 보여도 되는가는 "읽은 단위 집합" 하나로 정한다:
 * 메인은 진행도 포인터(그 장까지 봤다)까지 목록 순서대로 전부, 이벤트는 체크한 것만.
 * - 사전 항목은 첫 블록의 스토리를 읽어야 목록에 나오고, 블록은 각자의 스토리를 읽었으면 보인다 (이벤트는 순서 없이 읽으므로)
 * - 이름은 보이는 블록 중 마지막으로 이름이 적힌 블록의 것 (정체가 밝혀지는 인물)
 * - 숨은 블록이 몇 개인지는 알리지 않는다 (결정 D6) — 돌려주는 값에 넣지 않는다
 * - 관련 항목은 상대도 보일 때만, 상대의 **지금 보이는 이름**으로
 *
 * 저장된 진행도가 가리키는 id가 데이터에서 사라졌으면(운영자가 지움) 없는 것으로 친다 — 진행도를 지어내지 않는다.
 */

import type { EventUnit, MainUnit, StoryDoc, StoryEntry, StoryVolume, UnitId } from './types';

/** 저장 파일의 묶음 `story` (docs/008 9장) */
export interface StorySave {
	/** 메인 스토리를 이 장까지 봤다. null = 아직 안 봄 */
	mainUpTo: UnitId | null;
	/** 읽은 이벤트 스토리 */
	readEvents: UnitId[];
	/** 마지막으로 본 정렬 */
	order: StoryOrder;
}

export type StoryOrder = 'release' | 'chrono';
export type StoryUnit = MainUnit | EventUnit;

export const EMPTY_SAVE: StorySave = { mainUpTo: null, readEvents: [], order: 'release' };

export function isMain(unit: StoryUnit): unit is MainUnit {
	return 'chapter' in unit;
}

/** 저장값을 지금 데이터에 맞춘다: 없는 장·이벤트 id는 뺀다, 이벤트는 겹치지 않게 목록 순서로 */
export function normalizeSave(doc: StoryDoc, save: StorySave): StorySave {
	const mainUpTo = doc.main.some((u) => u.id === save.mainUpTo) ? save.mainUpTo : null;
	const read = new Set(save.readEvents);
	const readEvents = doc.events.filter((u) => read.has(u.id)).map((u) => u.id);
	return { mainUpTo, readEvents, order: save.order };
}

/** 읽은 단위 집합: 메인은 포인터까지 전부, 이벤트는 체크한 것 */
export function readSet(doc: StoryDoc, save: StorySave): Set<UnitId> {
	const read = new Set<UnitId>();
	const upTo = doc.main.findIndex((u) => u.id === save.mainUpTo);
	for (let i = 0; i <= upTo; i++) read.add(doc.main[i].id);
	const events = new Set(doc.events.map((u) => u.id));
	for (const id of save.readEvents) if (events.has(id)) read.add(id);
	return read;
}

// ------------------------------------------------------------ 사전

export interface VisibleEntry {
	id: string;
	entryType: StoryEntry['entryType'];
	name: string;
	/** 보이는 블록의 설명만 (어느 스토리 뒤인지·숨은 블록 수는 넣지 않는다) */
	texts: string[];
	/** 함께 보이는 관련 항목 — 상대의 지금 이름으로 */
	related: { id: string; name: string }[];
}

/** 항목 하나가 보이면 이름과 보이는 설명, 아니면 null (관련 항목은 visibleEntries가 채운다) */
export function visibleEntry(
	entry: StoryEntry,
	read: ReadonlySet<UnitId>
): Omit<VisibleEntry, 'related'> | null {
	const first = entry.blocks[0];
	if (!first || !read.has(first.after)) return null;
	let name = first.name;
	const texts: string[] = [];
	for (const block of entry.blocks) {
		if (!read.has(block.after)) continue;
		if (block.name.trim()) name = block.name;
		texts.push(block.text);
	}
	return { id: entry.id, entryType: entry.entryType, name, texts };
}

/** 보이는 사전 항목 전부 (문서 순서) */
export function visibleEntries(doc: StoryDoc, read: ReadonlySet<UnitId>): VisibleEntry[] {
	const shown = new Map<string, Omit<VisibleEntry, 'related'>>();
	for (const entry of doc.entries) {
		const v = visibleEntry(entry, read);
		if (v) shown.set(entry.id, v);
	}
	return doc.entries.flatMap((entry) => {
		const v = shown.get(entry.id);
		if (!v) return [];
		const related = entry.related.flatMap((id) => {
			const other = shown.get(id);
			return other && id !== entry.id ? [{ id, name: other.name }] : [];
		});
		return [{ ...v, related }];
	});
}

// ------------------------------------------------------------ 읽는 순서

/**
 * 공개순(release): 한국 첫 공개일, 같은 날이면 메인 목록 순서 → 이벤트 목록 순서. 공개일을 모르면 unknown.
 * 작중순(chrono): 작중 순서 키, 같으면 같은 방식. 작중 순서를 모르면(unknown) unknown.
 * unknown 묶음은 메인 목록 순서 → 이벤트 목록 순서.
 */
export function orderUnits(
	doc: StoryDoc,
	by: StoryOrder
): { ordered: StoryUnit[]; unknown: StoryUnit[] } {
	const all: StoryUnit[] = [...doc.main, ...doc.events];
	const known = (u: StoryUnit) =>
		by === 'release' ? u.releasedKr !== '' : u.chronoCertainty !== 'unknown';
	const ordered = all
		.map((u, i) => ({ u, i }))
		.filter(({ u }) => known(u))
		.sort((a, b) => {
			const d =
				by === 'release'
					? a.u.releasedKr.localeCompare(b.u.releasedKr)
					: a.u.chronoKey - b.u.chronoKey;
			return d !== 0 ? d : a.i - b.i;
		})
		.map(({ u }) => u);
	return { ordered, unknown: all.filter((u) => !known(u)) };
}

/** "먼저 읽으면 좋아요" — 단위 이름과 읽었는지 (없는 id는 뺀다) */
export function readAfterOf(
	doc: StoryDoc,
	unit: StoryUnit,
	read: ReadonlySet<UnitId>
): { id: UnitId; title: string; read: boolean }[] {
	if (isMain(unit)) return [];
	const byId = new Map<UnitId, StoryUnit>([...doc.main, ...doc.events].map((u) => [u.id, u]));
	return unit.readAfter.flatMap((id) => {
		const u = byId.get(id);
		return u ? [{ id, title: u.title, read: read.has(id) }] : [];
	});
}

// ------------------------------------------------------------ 읽는 순서 접기 (이미 본 쪽 / 앞으로 볼 쪽)

export interface ProgressSplit {
	/** 접어 두는 쪽 — 본 메인 장, 그리고 그 지점보다 앞에 놓인 이벤트(봤다고 했든 아니든). 정렬 순서 그대로 */
	past: StoryUnit[];
	/** 앞으로 볼 쪽 — 안 본 메인 장, 그 지점 뒤의 이벤트. 정렬 순서 그대로 */
	ahead: StoryUnit[];
	/** past 안에서 아직 봤다고 하지 않은 이벤트 수 — 접힌 줄에 알린다 */
	pastUnseenEvents: number;
}

/**
 * 정렬된 목록을 메인 진행도로 둘로 나눈다 (2026-11-17, docs/008 D12).
 * 기준은 이 정렬에서 **가장 뒤에 놓인 본 메인 장**이다.
 * - 그 자리까지의 이벤트는 함께 접는다. 봤는지는 메인 진행도로 알 수 없으니 안 본 수를 센다
 * - 안 본 메인 장은 기준보다 앞에 놓여 있어도 접지 않는다 — 공개순·작중순은 읽는 순서와 달라
 *   먼저 공개된 장을 나중에 읽기도 한다 (예: 1부 EX 1장)
 * - 기준 뒤의 이벤트는 봤다고 해도 접지 않는다 — 방금 체크한 줄이 눈앞에서 사라지지 않게
 * - 본 메인 장이 없으면 접지 않는다
 */
export function splitByProgress(
	ordered: readonly StoryUnit[],
	read: ReadonlySet<UnitId>
): ProgressSplit {
	let upTo = -1;
	ordered.forEach((u, i) => {
		if (isMain(u) && read.has(u.id)) upTo = i;
	});
	const past: StoryUnit[] = [];
	const ahead: StoryUnit[] = [];
	let pastUnseenEvents = 0;
	ordered.forEach((u, i) => {
		if (i > upTo || (isMain(u) && !read.has(u.id))) {
			ahead.push(u);
			return;
		}
		past.push(u);
		if (!isMain(u) && !read.has(u.id)) pastUnseenEvents++;
	});
	return { past, ahead, pastUnseenEvents };
}

/**
 * 메인 장의 "봤어요"를 풀 때의 새 진행도: 목록에서 그 장 바로 앞의 장.
 * 첫 장이면(또는 없는 id면) null = 아직 안 봄. 진행도가 "이 장까지"라서 그 장부터 뒤가 모두 안 본 것이 된다
 */
export function mainBefore(doc: StoryDoc, id: UnitId): UnitId | null {
	const i = doc.main.findIndex((u) => u.id === id);
	return i > 0 ? doc.main[i - 1].id : null;
}

// ------------------------------------------------------------ 진행도 고르기 (권 ▾ 장 ▾)

export interface VolumeChapters {
	volume: StoryVolume;
	chapters: MainUnit[];
}

/** 권마다 장 (메인 목록 순서). 장이 없는 권은 뺀다 */
export function volumesWithChapters(doc: StoryDoc): VolumeChapters[] {
	return doc.volumes.flatMap((volume) => {
		const chapters = doc.main.filter((u) => u.volume === volume.id);
		return chapters.length > 0 ? [{ volume, chapters }] : [];
	});
}

/** 메인 진행도 요약: 몇 장까지 봤는지 / 전체 장 수 */
export function mainProgress(doc: StoryDoc, save: StorySave): { read: number; total: number } {
	return { read: doc.main.findIndex((u) => u.id === save.mainUpTo) + 1, total: doc.main.length };
}
