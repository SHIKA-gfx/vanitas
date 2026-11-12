/**
 * 레포 data/*.json → 넣기 SQL (docs/006 7-1)
 *
 *   npm run data:seed-sql  →  supabase/seed.sql (레포에 넣지 않는다)
 *
 * 만든 파일을 Supabase SQL Editor에 통째로 붙여 넣고 실행한다. 게임 데이터 표 9개를 비우고 다시 넣는다.
 * 전환 직전(⑤)에 그때의 최신 JSON으로 다시 만든다.
 */
import { execSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { filesToRows } from '../src/lib/data/db/convert.ts';
import { seedSql } from '../src/lib/data/db/seed-sql.ts';
import { readDataFiles } from './lib/data-files.ts';

const OUT = 'supabase/seed.sql';

function commit(): string {
	try {
		return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
	} catch {
		return '알 수 없음';
	}
}

const rows = filesToRows(await readDataFiles());
const counts = `기간 ${rows.recruits.length} · 학생 ${rows.students.length} · 출처 ${rows.sources.length} · 문서 ${rows.datasets.length}`;
await writeFile(
	OUT,
	seedSql(rows, [
		`npm run data:seed-sql로 만듦 — ${new Date().toISOString()}, 커밋 ${commit()}`,
		counts,
		'레포에 넣지 않는다 (.gitignore)'
	]),
	'utf8'
);
console.log(`${OUT}를 만들었다 (${counts})`);
console.log('VS Code로 열어 전체 복사 → Supabase SQL Editor에 붙여 넣고 실행');
