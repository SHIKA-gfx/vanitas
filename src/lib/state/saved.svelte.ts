// 브라우저 저장 — 화면 연결 부분 (persist.ts의 순수 함수를 쓴다).
//
// 흐름
// - 저장소는 브라우저에서만 읽는다. 서버 렌더링은 기본값으로 그리고, 화면이 뜬 뒤(onMount) 저장값을 덮는다.
//   (서버와 브라우저의 첫 화면이 같아야 하이드레이션이 어긋나지 않는다)
// - 공유 값(UserState)은 레이아웃이, 계산기별 입력은 각 페이지가 persistSection으로 저장한다.
// - 입력이 바뀌면 바로 저장한다. 서버로는 아무것도 보내지 않는다.
//
// 공유 링크 (2026-10-02, 기획 B안)
// - 공유 링크로 열면 링크의 값으로 계산해서 보여주고, 저장은 멈춘다 (sharedView, paused).
//   내 저장값은 그대로 남아 있어서 "내 값으로 돌아가기"로 되돌릴 수 있다.
// - 이 상태에서 값을 하나라도 고치면 그때부터 지금 값이 내 저장값이 된다 (실수를 만회할 기회는 남기고,
//   고치려는 의도는 그대로 받아준다). 주소의 공유 값은 이때 지운다.

import { getContext, onMount, setContext } from 'svelte';
import { page } from '$app/state';
import { replaceState } from '$app/navigation';
import { resolve } from '$app/paths';
import type { Pathname } from '$app/types';
import { getApConfig, listBannerTypes } from '$lib/data';
import {
	emptySaveFile,
	isInt,
	isRecordOf,
	parseSaveFile,
	sanitize,
	STORAGE_KEY,
	withSection,
	type Check,
	type SaveFile
} from './persist';
import { decodeShare, shareQuery, type ShareField } from './share';
import { track } from '$lib/analytics';
import type { UserState } from './user-state.svelte';

const KEY = Symbol('saved-store');

export class SavedStore {
	#file: SaveFile = emptySaveFile();
	#storage: Storage | null = null;
	#opened = false;
	#user: UserState;

	/** 공유 값을 저장소에서 불러왔는가. 불러오기 전에는 저장하지 않는다 (기본값으로 덮어쓰지 않게) */
	userReady = $state(false);
	/** true면 저장하지 않는다 (공유 링크 보기 중) */
	paused = $state(false);
	/** 공유 링크로 연 값을 보고 있다 → 화면 아래에 "내 값으로 돌아가기" 띠 */
	sharedView = $state(false);

	#shared: {
		snapshot: () => string;
		baseline: string;
		restoreMine: () => void;
		saveAll: () => void;
		clearUrl: () => void;
		onLeave: (kept: boolean) => void;
	} | null = null;

	constructor(user: UserState) {
		this.#user = user;
	}

	/** 브라우저에서 처음 한 번 저장소를 연다. 사생활 보호 모드 등으로 막혀 있으면 저장 없이 동작한다 */
	#open() {
		if (this.#opened) return;
		this.#opened = true;
		try {
			this.#storage = window.localStorage;
			this.#file = parseSaveFile(this.#storage.getItem(STORAGE_KEY));
		} catch {
			this.#storage = null;
		}
	}

	read(section: string): unknown {
		this.#open();
		return this.#file.sections[section];
	}

	write(section: string, value: unknown) {
		this.#open();
		if (!this.#storage || this.paused) return;
		this.#file = withSection(this.#file, section, value);
		try {
			this.#storage.setItem(STORAGE_KEY, JSON.stringify(this.#file));
		} catch {
			// 저장 공간이 꽉 찼거나 막혔다. 계산은 계속된다
		}
	}

	/** 공유 값을 저장소에서 불러온다. 여러 번 불러도 처음 한 번만 */
	restoreUser() {
		if (this.userReady) return;
		this.applyUserFlat(this.read('user'));
		this.userReady = true;
	}

	/** 공유 값을 저장 형식(평평한 객체)으로 */
	userFlat(): UserFlat {
		const r = this.#user.resources;
		return {
			gems: r.gems,
			singleTickets: r.singleTickets,
			tenPullTickets: r.tenPullTickets,
			pointsByPool: $state.snapshot(r.pointsByPool),
			apPurchasesPerDay: this.#user.habits.apPurchasesPerDay
		};
	}

	/** 평평한 객체를 공유 값에 넣는다 (검사를 거친다) */
	applyUserFlat(raw: unknown) {
		const v = sanitizeUser(raw);
		const r = this.#user.resources;
		r.gems = v.gems;
		r.singleTickets = v.singleTickets;
		r.tenPullTickets = v.tenPullTickets;
		r.pointsByPool = v.pointsByPool;
		this.#user.habits.apPurchasesPerDay = v.apPurchasesPerDay;
	}

	// ---------------------------------------------------------------- 공유 링크 보기

	/**
	 * 공유 링크 보기를 시작한다.
	 * 저장소는 주소(SvelteKit page)를 모른다 — 주소를 지우는 일은 clearUrl로 넘겨받는다.
	 * (page는 컴포넌트 안에서만 읽을 수 있어서, 저장소가 직접 읽으면 테스트·서버에서 오류가 난다)
	 */
	enterShared(
		snapshot: () => string,
		restoreMine: () => void,
		saveAll: () => void,
		clearUrl: () => void = () => {},
		onLeave: (kept: boolean) => void = () => {}
	) {
		this.paused = true;
		this.sharedView = true;
		this.#shared = { snapshot, baseline: snapshot(), restoreMine, saveAll, clearUrl, onLeave };
	}

	/** 값이 바뀔 때마다 부른다. 공유 링크 보기 중에 사용자가 값을 고쳤으면 내 값으로 받아들인다 */
	noteChange() {
		const s = this.#shared;
		if (s && s.snapshot() !== s.baseline) this.#leaveShared(true);
	}

	/** "내 값으로 돌아가기" */
	backToMine() {
		this.#shared?.restoreMine();
		this.#leaveShared(false);
	}

	#leaveShared(keepCurrent: boolean) {
		const s = this.#shared;
		this.#shared = null;
		this.sharedView = false;
		this.paused = false;
		if (keepCurrent) s?.saveAll();
		s?.clearUrl();
		s?.onLeave(keepCurrent);
	}

	// ---------------------------------------------------------------- 백업 (다른 기기로 옮기기)

	/** 지금 저장된 전체 (공유 값은 화면의 최신 값으로) */
	exportFile(): SaveFile {
		this.#open();
		return withSection(this.#file, 'user', this.userFlat());
	}

	/** 백업 파일로 이 기기의 저장값을 통째로 바꾼다. 계산기별 입력은 각 화면을 열 때 칸마다 검사된다 */
	importFile(file: SaveFile) {
		this.#open();
		this.#file = file;
		try {
			this.#storage?.setItem(STORAGE_KEY, JSON.stringify(file));
		} catch {
			// 저장 공간이 막혔다. 이번 방문 동안은 화면에만 적용된다
		}
		this.applyUserFlat(file.sections.user);
		this.userReady = true;
	}

	saveUser() {
		this.write('user', this.userFlat());
	}
}

/**
 * 주소의 쿼리(공유 값, 백업)를 지운다. 새로고침해도 다시 공유 보기·불러오기로 들어가지 않게.
 * 컴포넌트 안(이벤트 처리 포함)에서만 부른다 — page는 컴포넌트 밖에서 읽을 수 없다.
 */
export function clearQuery() {
	if (!page.url.search) return;
	replaceState(resolve(page.url.pathname as Pathname), page.state);
}

export interface UserFlat {
	gems: number;
	singleTickets: number;
	tenPullTickets: number;
	pointsByPool: Record<string, number>;
	apPurchasesPerDay: number;
}

/** 공유 값을 공유 링크에 담을 때의 짧은 이름 */
const USER_SHARE_FIELDS: ShareField<keyof UserFlat>[] = [
	{ key: 'gems', param: 'g', kind: 'int' },
	{ key: 'singleTickets', param: 't1', kind: 'int' },
	{ key: 'tenPullTickets', param: 't10', kind: 'int' },
	{ key: 'pointsByPool', param: 'pt', kind: 'map-int' },
	{ key: 'apPurchasesPerDay', param: 'buy', kind: 'int' }
];

const USER_DEFAULTS: UserFlat = {
	gems: 0,
	singleTickets: 0,
	tenPullTickets: 0,
	pointsByPool: {},
	apPurchasesPerDay: 0
};

/** 공유 값의 저장 형식과 검사 */
function sanitizeUser(raw: unknown): UserFlat {
	const pools = [
		...new Set(listBannerTypes(false).flatMap((b) => (b.pointPool ? [b.pointPool] : [])))
	];
	const nonNegative = isInt(0);
	const checks = {
		gems: nonNegative,
		singleTickets: nonNegative,
		tenPullTickets: nonNegative,
		pointsByPool: isRecordOf(pools, (_, v) => nonNegative(v)),
		apPurchasesPerDay: isInt(0, getApConfig().purchase.maxPurchasesPerDay)
	};
	return sanitize(raw, { ...USER_DEFAULTS, pointsByPool: {} }, checks);
}

/** 최상위 레이아웃에서 한 번 부른다. 공유 값을 저장소와 이어 준다 */
export function provideSavedStore(user: UserState): SavedStore {
	const store = setContext(KEY, new SavedStore(user));
	onMount(() => store.restoreUser());
	$effect(() => {
		// 공유 값의 모든 칸을 읽어 두어야 그 칸이 바뀔 때 다시 저장한다
		JSON.stringify(user);
		if (!store.userReady) return;
		store.noteChange();
		store.saveUser();
	});
	return store;
}

export function getSavedStore(): SavedStore {
	const store = getContext<SavedStore | undefined>(KEY);
	if (!store)
		throw new Error('SavedStore가 없습니다. 최상위 레이아웃에서 provideSavedStore()를 부르세요.');
	return store;
}

export interface PersistedSection {
	/** 이 계산기의 입력을 기본값으로 돌린다. 되돌리기 함수를 돌려준다 */
	reset(): () => void;
	/** 지금 입력값을 담은 공유 링크 (공유 설정이 있을 때) */
	shareUrl(): string;
}

/** 공유 링크 설정: 이 계산기의 칸들 + 함께 담을 공유 값 */
export interface ShareSpec<T> {
	fields: ShareField<Extract<keyof T, string>>[];
	user: (keyof UserFlat)[];
}

/**
 * 계산기 한 화면의 입력을 저장소와 잇는다. 페이지 초기화 중에 부른다.
 * @param name 저장 묶음 이름 ('levelup' 등)
 * @param get 지금 입력값 (반응형으로 읽힌다)
 * @param set 입력값을 한 번에 바꾼다
 * @param defaults 기본값 (날짜처럼 오늘에 따라 바뀌는 값이 있어 함수로)
 * @param checks 칸마다 검사 — 통과하지 못한 칸은 기본값으로
 */
export function persistSection<T extends Record<string, unknown>>(
	name: string,
	get: () => T,
	set: (value: T) => void,
	defaults: () => T,
	checks: { [K in keyof T]: Check },
	share?: ShareSpec<T>
): PersistedSection {
	const store = getSavedStore();
	let ready = $state(false);
	const snapshotSection = () => $state.snapshot(get()) as T;
	const userFields = USER_SHARE_FIELDS.filter((f) => share?.user.includes(f.key));

	onMount(() => {
		// 페이지가 레이아웃보다 먼저 마운트되므로 공유 값도 여기서 먼저 불러 둔다
		store.restoreUser();
		set(sanitize(store.read(name), defaults(), checks));
		if (share) openSharedLink();
		ready = true;
	});

	/** 주소에 공유 값이 있으면: 내 값은 남겨 두고, 링크의 값(기본값 위에 얹은 것)으로 보여준다 */
	function openSharedLink() {
		if (!share) return;
		const params = page.url.searchParams;
		const section = decodeShare(params, share.fields);
		const user = decodeShare(params, userFields);
		if (!section.found && !user.found) return;

		const mineSection = snapshotSection();
		const mineUser = store.userFlat();

		set(sanitize({ ...defaults(), ...section.values }, defaults(), checks));
		const sharedUser: Record<string, unknown> = { ...mineUser };
		for (const f of userFields) sharedUser[f.key] = user.values[f.key] ?? USER_DEFAULTS[f.key];
		store.applyUserFlat(sharedUser);

		store.enterShared(
			() => JSON.stringify([snapshotSection(), store.userFlat()]),
			() => {
				set(mineSection);
				store.applyUserFlat(mineUser);
			},
			() => {
				store.write(name, snapshotSection());
				store.saveUser();
			},
			clearQuery,
			(kept) => track(kept ? 'shared-keep' : 'shared-back', { calc: name })
		);
		track('shared-open', { calc: name });
	}

	// 이 화면에서 처음 값을 바꾸면 한 번 알린다 (불러오기·공유 링크로 바뀐 값은 세지 않는다)
	let baseline = '';
	let used = false;
	const combined = () => JSON.stringify([snapshotSection(), store.userFlat()]);

	$effect(() => {
		const value = snapshotSection();
		JSON.stringify(store.userFlat()); // 공유 값(보유 청휘석 등)을 바꿔도 "계산했다"로 본다
		if (!ready) return;
		if (!used) {
			if (!baseline) baseline = combined();
			else if (combined() !== baseline) {
				used = true;
				track('calc-used', { calc: name });
			}
		}
		store.noteChange();
		store.write(name, value);
	});

	return {
		reset() {
			const before = snapshotSection();
			set(defaults());
			return () => set(before);
		},
		shareUrl() {
			const query = share
				? shareQuery([
						[snapshotSection(), defaults(), share.fields],
						[store.userFlat(), USER_DEFAULTS, userFields]
					])
				: '';
			return `${page.url.origin}${page.url.pathname}${query ? `?${query}` : ''}`;
		}
	};
}
