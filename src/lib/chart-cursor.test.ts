import { describe, expect, it } from 'vitest';
import { ChartCursor } from './chart-cursor.svelte';

const key = (k: string, shiftKey = false) =>
	({ key: k, shiftKey, preventDefault() {} }) as unknown as KeyboardEvent;

describe('ChartCursor 키보드', () => {
	// 0~199일, 점 200개 → 1% = 2칸, 10% = 20칸
	const days = Array.from({ length: 200 }, (_, i) => i);
	const make = () =>
		new ChartCursor(
			() => days,
			(vx) => vx,
			320
		);

	it('처음엔 아무 점도 고르지 않는다', () => {
		expect(make().index).toBeNull();
	});

	it('방향키 1%, Shift 10%, 양 끝에서 멈춘다', () => {
		const c = make();
		c.onkeydown(key('ArrowRight'));
		expect(c.index).toBe(2);
		c.onkeydown(key('ArrowRight', true));
		expect(c.index).toBe(22);
		c.onkeydown(key('ArrowLeft', true));
		c.onkeydown(key('ArrowLeft', true));
		expect(c.index).toBe(0);
	});

	it('Home·End로 처음과 끝, Esc로 지운다', () => {
		const c = make();
		c.onkeydown(key('End'));
		expect(c.index).toBe(199);
		c.onkeydown(key('Home'));
		expect(c.index).toBe(0);
		c.onkeydown(key('Escape'));
		expect(c.index).toBeNull();
	});

	it('그래프에서 초점이 나가면 지운다', () => {
		const c = make();
		c.onkeydown(key('End'));
		c.onblur();
		expect(c.index).toBeNull();
	});
});
