// 브라우저 저장 — 화면 연결 부분 (persist.ts의 순수 함수를 쓴다).
//
// 흐름
// - 저장소는 브라우저에서만 읽는다. 서버 렌더링은 기본값으로 그리고, 화면이 뜬 뒤(onMount) 저장값을 덮는다.
//   (서버와 브라우저의 첫 화면이 같아야 하이드레이션이 어긋나지 않는다)
// - 공유 값(UserState)은 레이아웃이, 계산기별 입력은 각 페이지가 persistSection으로 저장한다.
// - 입력이 바뀌면 바로 저장한다. 서버로는 아무것도 보내지 않는다.
// - paused: 공유 링크를 보는 동안에는 저장을 멈춘다 (공유 링크 작업에서 쓴다).

import { getContext, onMount, setContext } from 'svelte';
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
		const saved = sanitizeUser(this.read('user'));
		const r = this.#user.resources;
		r.gems = saved.gems;
		r.singleTickets = saved.singleTickets;
		r.tenPullTickets = saved.tenPullTickets;
		r.pointsByPool = saved.pointsByPool;
		this.#user.habits.apPurchasesPerDay = saved.apPurchasesPerDay;
		this.userReady = true;
	}

	saveUser() {
		const r = this.#user.resources;
		this.write('user', {
			gems: r.gems,
			singleTickets: r.singleTickets,
			tenPullTickets: r.tenPullTickets,
			pointsByPool: $state.snapshot(r.pointsByPool),
			apPurchasesPerDay: this.#user.habits.apPurchasesPerDay
		});
	}
}

/** 공유 값의 저장 형식과 검사 */
function sanitizeUser(raw: unknown) {
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
	return sanitize(
		raw,
		{
			gems: 0,
			singleTickets: 0,
			tenPullTickets: 0,
			pointsByPool: {} as Record<string, number>,
			apPurchasesPerDay: 0
		},
		checks
	);
}

/** 최상위 레이아웃에서 한 번 부른다. 공유 값을 저장소와 이어 준다 */
export function provideSavedStore(user: UserState): SavedStore {
	const store = setContext(KEY, new SavedStore(user));
	onMount(() => store.restoreUser());
	$effect(() => {
		// 공유 값의 모든 칸을 읽어 두어야 그 칸이 바뀔 때 다시 저장한다
		JSON.stringify(user);
		if (store.userReady) store.saveUser();
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
	checks: { [K in keyof T]: Check }
): PersistedSection {
	const store = getSavedStore();
	let ready = $state(false);

	onMount(() => {
		// 페이지가 레이아웃보다 먼저 마운트되므로 공유 값도 여기서 먼저 불러 둔다
		store.restoreUser();
		set(sanitize(store.read(name), defaults(), checks));
		ready = true;
	});

	$effect(() => {
		const value = $state.snapshot(get());
		if (ready) store.write(name, value);
	});

	return {
		reset() {
			const before = $state.snapshot(get()) as T;
			set(defaults());
			return () => set(before);
		}
	};
}
