/**
 * 스토리 길잡이 데이터 `data/ko/story.json`의 모양 (docs/008 6장).
 *
 * 칸은 늘 모두 있다 — "없음"은 빈 글자·빈 목록·0(chronoKey)으로 적는다. 관리자 화면의 편집기가
 * 칸을 더하거나 빼지 못하고 숫자 칸을 비우지 못해서다 (src/routes/admin/doc-edit.ts). 같은 까닭으로
 * 메인·이벤트를 목록 둘로 나눴다 (종류마다 칸이 달라 한 표에 두면 빈 칸이 생긴다). 메인은 목록 순서가 진행 순서다.
 * 고르는 칸의 이름(chronoCertainty·replayable·entryType)은 관리자 화면의 선택지 표(ENUMS)가 칸 이름으로 찾으므로
 * 다른 문서의 칸 이름(kind 등)과 겹치지 않게 지었다.
 * 검사는 validate.py check_story가 한다 (빌드·관리자 저장 전 검사가 같은 파일을 돌린다).
 */

/** 메인 스토리 장·이벤트 스토리의 id (예: 'main-v1-c1', 'event-<slug>') */
export type UnitId = string;

/** 작중 순서의 확실성. unknown이면 chronoKey 0 → "작중 시점 미확인" 묶음 */
export type ChronoCertainty = 'unknown' | 'stated' | 'inferred';
/** 지금 게임 안에서 다시 볼 수 있는지 — 확인 전에는 unknown */
export type Replayable = 'unknown' | 'yes' | 'no';
export type EntryType = 'person' | 'group' | 'place' | 'term';

export interface StoryVolume {
	id: string;
	/** 한국 서버 표기 (예: "대책위원회 편") */
	title: string;
	sources: string[];
	verified: boolean;
}

/** 메인·이벤트 단위가 함께 갖는 칸 */
interface UnitBase {
	id: UnitId;
	/** 한국 서버 표기 */
	title: string;
	/** 한국 서버 첫 공개일 YYYY-MM-DD (복각 아님). 모르면 '' */
	releasedKr: string;
	/** 작중 시간 정렬 키 (100 단위로 띄운다). unknown이면 0 */
	chronoKey: number;
	chronoCertainty: ChronoCertainty;
	/** "Vol.3 2장과 3장 사이" 같은 위치 설명. 없으면 '' */
	chronoNote: string;
	/** stated면 필수 */
	chronoSources: string[];
	replayable: Replayable;
	sources: string[];
	verified: boolean;
}

/**
 * 메인 스토리 장 (진행도 단위, 결정 D5). 배열 순서가 진행(읽는) 순서 — 권 순서와 다를 수 있어
 * 같은 권의 장이 떨어져 있어도 된다. 권 안에서 장 번호는 늘어난다 (docs/008 6-2)
 */
export interface MainUnit extends UnitBase {
	/** StoryVolume.id */
	volume: string;
	/** 권 안의 장 번호 (1부터) */
	chapter: number;
}

export interface EventUnit extends UnitBase {
	/** "먼저 읽으면 좋아요" — 메인 장·다른 이벤트의 id */
	readAfter: UnitId[];
	readAfterSources: string[];
}

export interface EntryBlock {
	/** 이 단위를 읽었으면 블록이 보인다 */
	after: UnitId;
	/** 이 블록부터 바뀌는 이름. 첫 블록은 필수, 그 뒤는 바뀔 때만 ('' = 그대로) */
	name: string;
	/** 운영자가 직접 쓴 설명. 대사 인용·나무위키 문장 금지 (docs/008 7장) */
	text: string;
}

export interface StoryEntry {
	id: string;
	entryType: EntryType;
	/**
	 * 덮어쓰기가 아니라 덧붙이기. **첫 블록의 after가 처음 등장** — 그 단위를 읽기 전에는 목록에도 없다.
	 * (처음 등장을 따로 적는 칸은 두지 않는다: 첫 블록과 늘 같아야 해서 어긋날 일만 생긴다, 2026-11-16)
	 */
	blocks: EntryBlock[];
	/** 다른 항목 id. 상대 항목이 보일 때만 잇는다 */
	related: string[];
	sources: string[];
	verified: boolean;
}

export interface StoryDoc {
	meta: { description: string; verifiedAt: string; sources: string[] } & Record<string, unknown>;
	volumes: StoryVolume[];
	main: MainUnit[];
	events: EventUnit[];
	entries: StoryEntry[];
}
