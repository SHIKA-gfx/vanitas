import { afterEach, describe, expect, it, vi } from 'vitest';
import { SavedStore } from './saved.svelte';
import { createUserState } from './user-state.svelte';
import { STORAGE_KEY } from './persist';

/** 브라우저 저장소 흉내 */
function fakeStorage(initial?: unknown) {
	const map = new Map<string, string>();
	if (initial !== undefined) map.set(STORAGE_KEY, JSON.stringify(initial));
	const storage = {
		getItem: (k: string) => map.get(k) ?? null,
		setItem: (k: string, v: string) => void map.set(k, v)
	};
	vi.stubGlobal('window', { localStorage: storage });
	return map;
}

afterEach(() => vi.unstubAllGlobals());

describe('SavedStore', () => {
	it('공유 값을 불러오고, 맞지 않는 칸만 기본값으로', () => {
		fakeStorage({
			version: 1,
			sections: { user: { gems: 24000, singleTickets: -3, apPurchasesPerDay: 6 } }
		});
		const user = createUserState();
		new SavedStore(user).restoreUser();
		expect(user.resources.gems).toBe(24000);
		expect(user.resources.singleTickets).toBe(0); // 음수는 버림
		expect(user.habits.apPurchasesPerDay).toBe(6);
	});

	it('불러오기 전에는 쓰지 않는다 → 처음 연 화면이 저장값을 기본값으로 덮지 않는다', () => {
		const map = fakeStorage({ version: 1, sections: { user: { gems: 500 } } });
		const store = new SavedStore(createUserState());
		expect(store.userReady).toBe(false);
		store.restoreUser();
		store.saveUser();
		expect(JSON.parse(map.get(STORAGE_KEY)!).sections.user.gems).toBe(500);
	});

	it('묶음별로 쓰고, 멈춘 동안에는 쓰지 않는다', () => {
		const map = fakeStorage();
		const store = new SavedStore(createUserState());
		store.write('levelup', { level: 60 });
		store.paused = true;
		store.write('levelup', { level: 70 });
		expect(JSON.parse(map.get(STORAGE_KEY)!).sections.levelup).toEqual({ level: 60 });
	});

	it('저장소가 막혀 있어도 오류 없이 동작한다', () => {
		vi.stubGlobal('window', {
			get localStorage(): Storage {
				throw new Error('denied');
			}
		});
		const store = new SavedStore(createUserState());
		expect(() => store.write('pity', { bannerId: 'x' })).not.toThrow();
		expect(store.read('pity')).toBeUndefined();
	});
});

describe('공유 링크 보기 (B안)', () => {
	function setup() {
		const map = fakeStorage({ version: 1, sections: { user: { gems: 500 } } });
		const user = createUserState();
		const store = new SavedStore(user);
		store.restoreUser();
		// 링크의 값으로 바꾼 상태라고 가정
		const mine = store.userFlat();
		store.applyUserFlat({ ...mine, gems: 24000 });
		let saved = 0;
		store.enterShared(
			() => JSON.stringify(store.userFlat()),
			() => store.applyUserFlat(mine),
			() => {
				saved += 1;
				store.saveUser();
			}
		);
		return { map, user, store, savedCount: () => saved };
	}

	it('보는 동안에는 저장하지 않는다 (내 저장값 그대로)', () => {
		const { map, store } = setup();
		expect(store.sharedView).toBe(true);
		store.noteChange(); // 값이 그대로면 보기 유지
		store.saveUser();
		expect(store.sharedView).toBe(true);
		expect(JSON.parse(map.get(STORAGE_KEY)!).sections.user.gems).toBe(500);
	});

	it('값을 고치면 그때부터 지금 값이 내 저장값이 된다', () => {
		const { map, user, store, savedCount } = setup();
		user.resources.gems = 30000;
		store.noteChange();
		expect(store.sharedView).toBe(false);
		expect(savedCount()).toBe(1);
		expect(JSON.parse(map.get(STORAGE_KEY)!).sections.user.gems).toBe(30000);
	});

	it('"내 값으로 돌아가기"는 내 값을 되살리고 저장값을 건드리지 않는다', () => {
		const { map, user, store, savedCount } = setup();
		store.backToMine();
		expect(store.sharedView).toBe(false);
		expect(user.resources.gems).toBe(500);
		expect(savedCount()).toBe(0);
		expect(JSON.parse(map.get(STORAGE_KEY)!).sections.user.gems).toBe(500);
	});
});
