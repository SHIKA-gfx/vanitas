import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { formatJson, WIDTH } from './format-json';

describe('압축 서식 (docs/006 7-3)', () => {
	it('한 줄에 들어가면 안쪽 묶음까지 한 줄', () => {
		expect(formatJson({ a: [1, 2], b: { c: 'x' } })).toBe('{ "a": [1, 2], "b": { "c": "x" } }\n');
	});

	it('들어가지 않으면 펴고 안쪽에 같은 규칙', () => {
		const value = { banners: [{ type: 'fes', students: ['ibuki_swimsuit'] }], note: 'n'.repeat(90) };
		expect(formatJson(value)).toBe(
			[
				'{',
				'  "banners": [{ "type": "fes", "students": ["ibuki_swimsuit"] }],',
				`  "note": "${'n'.repeat(90)}"`,
				'}',
				''
			].join('\n')
		);
	});

	it('폭 경계: 쉼표까지 WIDTH자면 한 줄, 한 자 넘으면 편다', () => {
		// 줄 = 2칸 + "k": (5자) + [ "…" ] + 쉼표
		const fits = (n: number) => ({ k: ['x'.repeat(n)], z: 0 });
		const lineOf = (n: number) => formatJson(fits(n)).split('\n')[1];
		const n = WIDTH - 2 - 5 - 4 - 1; // [" + "] = 4자, 쉼표 1자
		expect(lineOf(n)).toHaveLength(WIDTH);
		expect(lineOf(n + 1)).toBe('  "k": [');
	});

	it('빈 배열·객체, 한국어, 끝 줄바꿈 하나', () => {
		expect(formatJson({ a: [], b: {}, c: '한국어' })).toBe('{ "a": [], "b": {}, "c": "한국어" }\n');
	});

	it('JSON에 없는 값은 멈춘다', () => {
		expect(() => formatJson({ a: undefined })).toThrow(/쓸 수 없는 값/);
		expect(() => formatJson({ a: Number.NaN })).toThrow(/쓸 수 없는 숫자/);
	});

	it('레포 파일: 값·키 순서가 그대로이고 두 번 써도 같다', () => {
		for (const name of readdirSync('data', { recursive: true }) as string[]) {
			if (!name.endsWith('.json')) continue;
			const value = JSON.parse(readFileSync(join('data', name), 'utf8'));
			const text = formatJson(value);
			expect(JSON.stringify(JSON.parse(text)), name).toBe(JSON.stringify(value));
			expect(formatJson(JSON.parse(text)), name).toBe(text);
		}
	});
});
