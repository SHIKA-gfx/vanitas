import { describe, expect, it } from 'vitest';
import { createUserState } from './user-state.svelte';

describe('createUserState', () => {
	it('보유 재화와 습관의 기본값은 0', () => {
		const s = createUserState();
		expect(s.resources).toEqual({
			gems: 0,
			singleTickets: 0,
			tenPullTickets: 0,
			pointsByPool: {}
		});
		expect(s.habits).toEqual({ apPurchasesPerDay: 0 });
	});

	it('방문자마다 따로 만들어진다 (서로 값이 섞이지 않는다)', () => {
		const a = createUserState();
		const b = createUserState();
		a.resources.gems = 24000;
		a.resources.pointsByPool.recruit = 120;
		expect(b.resources.gems).toBe(0);
		expect(b.resources.pointsByPool).toEqual({});
	});
});
