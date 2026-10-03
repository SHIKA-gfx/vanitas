import { describe, expect, it } from 'vitest';
import { decodeBackup, encodeBackup } from './backup';
import { SAVE_VERSION, type SaveFile } from './persist';

const file: SaveFile = {
	version: SAVE_VERSION,
	sections: {
		user: {
			gems: 24000,
			singleTickets: 1,
			tenPullTickets: 0,
			pointsByPool: { recruit: 120 },
			apPurchasesPerDay: 6
		},
		pity: { bannerId: 'pickup_normal' },
		levelup: {
			mode: 'date',
			level: 75,
			exp: 1200,
			targetDate: '2027-01-01',
			disabledIncome: ['weekly-mission']
		},
		income: {
			endDate: '2026-12-31',
			subscriptions: { 'monthly-pass': 'continuous', 'half-pass': '0' }
		}
	}
};

describe('백업 링크', () => {
	it('압축해서 담고, 다시 읽으면 같다', async () => {
		const text = await encodeBackup(file);
		expect(text.startsWith('1z')).toBe(true);
		expect(text).toMatch(/^[\w-]+$/); // 주소에 그대로 넣을 수 있는 글자만
		expect(await decodeBackup(text)).toEqual(file);
	});

	it('세 계산기 전체를 담아도 주소가 짧다', async () => {
		const text = await encodeBackup(file);
		expect(text.length).toBeLessThan(JSON.stringify(file).length);
	});

	it('읽을 수 없는 값은 null', async () => {
		expect(await decodeBackup('')).toBeNull();
		expect(await decodeBackup('2zabc')).toBeNull(); // 모르는 판
		expect(await decodeBackup('1zNOT_DEFLATE')).toBeNull();
		expect(await decodeBackup('1x' + 'a'.repeat(10))).toBeNull(); // 모르는 방식
	});
});
