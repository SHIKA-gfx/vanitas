/**
 * DB → data/*.json (docs/006 3장 빌드 1단계, 7-1)
 *
 *   npm run data:export  빌드(build:pages) 첫 단계. VANITAS_DATA_SOURCE=db일 때만 DB를 읽어 data/를 덮어쓴다.
 *                        json(기본)이면 아무것도 하지 않는다 — 레포 JSON으로 빌드
 *   npm run data:pull    로컬. .env의 공개용 키로 DB를 읽어 data/를 덮어쓴다 (스냅샷)
 *   npm run data:check   로컬. DB를 읽어 레포 data/와 비교만 한다 (쓰지 않는다)
 *
 * 공개용 키(anon)로 읽기만 한다 — 게임 데이터 표는 누구나 읽을 수 있다 (docs/006 5-1).
 * 못 읽거나, 비어 있거나, 레포 파일과 목록이 안 맞으면 0이 아닌 코드로 끝난다 → 빌드가 멈춘다 (결정 C).
 */
import type { GameDataRows, TableName } from '../src/lib/data/db/rows.ts';
import { TABLES } from '../src/lib/data/db/rows.ts';
import { rowsToFiles } from '../src/lib/data/db/convert.ts';
import { compareJson, readDataFiles, writeDataFiles } from './lib/data-files.ts';

/** Supabase Data API가 한 번에 돌려주는 최대 행 수 (기본 설정). 넘으면 나눠 읽어야 한다 */
const MAX_ROWS = 1000;

const args = new Set(process.argv.slice(2));
const checkOnly = args.has('--check');
const source = args.has('--db') ? 'db' : process.env.VANITAS_DATA_SOURCE?.trim() || 'json';

class ExportError extends Error {}

async function readTable(base: string, key: string, table: TableName): Promise<unknown[]> {
	let res: Response;
	try {
		res = await fetch(`${base}/rest/v1/${table}?select=*`, {
			headers: { apikey: key, Accept: 'application/json' },
			signal: AbortSignal.timeout(20_000)
		});
	} catch (e) {
		throw new ExportError(`${table}: 연결 실패 — ${(e as Error).message}`);
	}
	if (!res.ok) {
		const body = (await res.text()).slice(0, 300);
		throw new ExportError(`${table}: HTTP ${res.status} ${body}`);
	}
	const rows: unknown = await res.json();
	if (!Array.isArray(rows)) throw new ExportError(`${table}: 배열이 아닌 응답`);
	if (rows.length >= MAX_ROWS) {
		throw new ExportError(
			`${table}: ${rows.length}행 — 한 번에 읽는 한도(${MAX_ROWS})에 닿았다. 나눠 읽기가 필요하다`
		);
	}
	return rows;
}

async function main(): Promise<void> {
	if (source === 'json') {
		console.log('데이터: 레포 JSON 그대로 (VANITAS_DATA_SOURCE=json)');
		return;
	}
	if (source !== 'db')
		throw new ExportError(`VANITAS_DATA_SOURCE는 json 또는 db여야 한다: '${source}'`);

	const url = process.env.PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, '');
	const key = process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
	if (!url || !key) {
		throw new ExportError(
			'PUBLIC_SUPABASE_URL·PUBLIC_SUPABASE_PUBLISHABLE_KEY가 없다 (로컬은 .env, 빌드는 Cloudflare 환경 변수)'
		);
	}

	const read = await Promise.all(TABLES.map((t) => readTable(url, key, t)));
	const rows = Object.fromEntries(TABLES.map((t, i) => [t, read[i]])) as unknown as GameDataRows;

	for (const t of ['sources', 'students', 'recruits', 'datasets'] as const) {
		if (rows[t].length === 0)
			throw new ExportError(`${t} 표가 비어 있다 — 넣기(npm run data:seed-sql)를 했는지 본다`);
	}
	const repo = await readDataFiles();
	const dbPaths = new Set(rows.datasets.map((d) => d.path));
	const missing = Object.keys(repo).filter((p) => !dbPaths.has(p));
	const extra = [...dbPaths].filter((p) => !(p in repo));
	if (missing.length > 0 || extra.length > 0) {
		throw new ExportError(
			`레포 data/와 DB datasets의 파일 목록이 다르다 — DB에 없음: [${missing.join(', ')}], 레포에 없음: [${extra.join(', ')}]`
		);
	}

	const files = rowsToFiles(rows);
	const counts = `기간 ${rows.recruits.length} · 학생 ${rows.students.length} · 출처 ${rows.sources.length} · 문서 ${rows.datasets.length}`;

	if (checkOnly) {
		let different = 0;
		for (const path of Object.keys(files)) {
			const result = compareJson(files[path], repo[path]);
			if (result === 'different') different++;
			const label = { same: '같음', order: '값은 같음 (키 순서만 다름)', different: '값이 다름' }[
				result
			];
			console.log(`${path.padEnd(28)} ${label}`);
		}
		console.log(`\nDB: ${counts}`);
		if (different > 0) throw new ExportError(`레포와 값이 다른 파일 ${different}개`);
		console.log('레포 data/와 DB의 값이 같다');
		return;
	}

	const changed = await writeDataFiles(files);
	console.log(`데이터: DB에서 읽음 (${counts})`);
	console.log(
		changed.length > 0 ? `바뀐 파일 ${changed.length}개: ${changed.join(', ')}` : '바뀐 파일 없음'
	);
}

main().catch((e: unknown) => {
	const known =
		e instanceof ExportError || (e instanceof Error && e.message.startsWith('데이터 변환:'));
	console.error(`데이터 내보내기 실패: ${known ? (e as Error).message : e}`);
	process.exitCode = 1;
});
