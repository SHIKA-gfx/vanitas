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
