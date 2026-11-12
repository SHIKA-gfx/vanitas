/**
 * data/ 아래 JSON 파일 읽기·쓰기 (scripts/data-*.ts가 같이 쓴다).
 * Node가 바로 실행하므로 상대 경로 import에 .ts를 붙인다 (src/lib/data/db/rows.ts 머리말).
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, sep } from 'node:path';
import type { DataFiles } from '../../src/lib/data/db/convert.ts';
import { formatJson } from '../../src/lib/data/db/format-json.ts';

export const DATA_DIR = 'data';

/** data/ 아래 *.json 전부. 키는 data/ 기준 경로를 '/'로 이은 것 (예: 'ko/schedule.json') */
export async function readDataFiles(dir = DATA_DIR): Promise<DataFiles> {
	const files: DataFiles = {};
	const names = (await readdir(dir, { recursive: true })).filter((n) => n.endsWith('.json'));
	for (const name of names.sort()) {
		const text = await readFile(join(dir, name), 'utf8');
		files[name.split(sep).join('/')] = JSON.parse(text);
	}
	return files;
}

/** 서식(formatJson)으로 쓰고, 글자가 바뀐 파일 경로를 돌려준다 */
export async function writeDataFiles(files: DataFiles, dir = DATA_DIR): Promise<string[]> {
	const changed: string[] = [];
	for (const [path, doc] of Object.entries(files)) {
		const file = join(dir, ...path.split('/'));
		const text = formatJson(doc);
		const before = await readFile(file, 'utf8').catch(() => null);
		if (before !== text) {
			await writeFile(file, text, 'utf8');
			changed.push(path);
		}
	}
	return changed;
}

/** 두 JSON 값 비교: 같음 / 키 순서만 다름 / 값이 다름 */
export function compareJson(a: unknown, b: unknown): 'same' | 'order' | 'different' {
	if (JSON.stringify(a) === JSON.stringify(b)) return 'same';
	return JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b)) ? 'order' : 'different';
}

function sortKeys(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(sortKeys);
	if (typeof value === 'object' && value !== null) {
		const obj = value as Record<string, unknown>;
		return Object.fromEntries(
			Object.keys(obj)
				.sort()
				.map((k) => [k, sortKeys(obj[k])])
		);
	}
	return value;
}
