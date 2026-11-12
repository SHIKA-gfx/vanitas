/**
 * 레포 data/*.json을 내보내기와 같은 모양으로 다시 쓴다 (docs/006 7-3, 결정 E)
 *
 *   npm run data:format          키 순서(표로 옮긴 행)와 서식(압축 서식)을 맞춰 쓴다. 값은 바뀌지 않는다
 *   npm run data:format -- --check   쓰지 않고, 맞지 않는 파일이 있으면 실패
 *
 * 한 번 맞춘 뒤로는 DB 스냅샷 PR에 실제로 바뀐 값만 보인다.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { filesToRows, rowsToFiles } from '../src/lib/data/db/convert.ts';
import { formatJson } from '../src/lib/data/db/format-json.ts';
import { compareJson, DATA_DIR, readDataFiles, writeDataFiles } from './lib/data-files.ts';

const checkOnly = process.argv.includes('--check');
const repo = await readDataFiles();
const canonical = rowsToFiles(filesToRows(repo));

for (const path of Object.keys(repo)) {
	if (compareJson(canonical[path], repo[path]) === 'different') {
		throw new Error(`${path}: 값이 바뀐다 — 변환을 고쳐야 한다`);
	}
}

if (checkOnly) {
	const off: string[] = [];
	for (const path of Object.keys(canonical)) {
		const text = await readFile(join(DATA_DIR, ...path.split('/')), 'utf8');
		if (text !== formatJson(canonical[path])) off.push(path);
	}
	if (off.length > 0) {
		console.error(`서식이 맞지 않는 파일 ${off.length}개: ${off.join(', ')} — npm run data:format`);
		process.exitCode = 1;
	} else {
		console.log('data/ 서식이 내보내기와 같다');
	}
} else {
	const changed = await writeDataFiles(canonical);
	console.log(
		changed.length > 0
			? `다시 쓴 파일 ${changed.length}개: ${changed.join(', ')}`
			: '바꿀 파일 없음'
	);
}
