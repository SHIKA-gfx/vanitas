import { readdirSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALL_SECTIONS, DOC_GROUPS, TABLED, TOP_LABELS } from './doc-sections';

/** 레포 data/*.json 전부 (테스트는 레포 루트에서 돈다) */
function repoFiles(): Record<string, Record<string, unknown>> {
	const files: Record<string, Record<string, unknown>> = {};
	for (const name of readdirSync('data', { recursive: true }) as string[]) {
		if (!name.endsWith('.json')) continue;
		files[name.split(sep).join('/')] = JSON.parse(readFileSync(join('data', name), 'utf8'));
	}
	return files;
}

describe('데이터 문서 묶음', () => {
	const files = repoFiles();

	it('문서 10개의 맨 위 칸은 모두 꼭 한 묶음에 들어간다 ($schema와 표로 뺀 칸은 빼고)', () => {
		const seen = new Map<string, string>();
		for (const s of ALL_SECTIONS) {
			for (const k of s.keys) {
				const where = `${s.path}:${k}`;
				expect(seen.has(where), `${where}이(가) ${seen.get(where)}와 ${s.id}에 함께 있다`).toBe(
					false
				);
				seen.set(where, s.id);
			}
		}
		const expected = Object.entries(files).flatMap(([path, doc]) =>
			Object.keys(doc)
				.filter((k) => k !== '$schema' && !(`${path}:${k}` in TABLED))
				.map((k) => `${path}:${k}`)
		);
		expect([...seen.keys()].sort()).toEqual(expected.sort());
	});

	it('묶음의 칸 순서는 문서 순서와 같다', () => {
		for (const s of ALL_SECTIONS) {
			const order = Object.keys(files[s.path]);
			const idx = s.keys.map((k) => order.indexOf(k));
			expect(idx, s.id).toEqual([...idx].sort((a, b) => a - b));
		}
	});

	it('묶음 id는 겹치지 않는다', () => {
		const ids = ALL_SECTIONS.map((s) => s.id);
		expect(new Set(ids).size).toBe(ids.length);
		expect(DOC_GROUPS.every((g) => g.sections.length > 0)).toBe(true);
	});

	it('맨 위 칸 이름 바꾸기는 묶음에 있는 칸만', () => {
		const shown = new Set(ALL_SECTIONS.flatMap((s) => s.keys.map((k) => `${s.path}:${k}`)));
		for (const k of Object.keys(TOP_LABELS)) expect(shown.has(k), k).toBe(true);
	});
});
