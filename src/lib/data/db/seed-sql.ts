/**
 * 넣기 SQL (docs/006 7-1). 표 9개를 비우고 행을 다시 넣는 SQL 한 덩어리를 만든다.
 * 사용자가 Supabase SQL Editor에서 실행한다 (postgres 역할) — 비밀 키가 필요 없다.
 *
 * - 한 트랜잭션: 중간에 실패하면 아무것도 바뀌지 않는다
 * - 비우기는 truncate: 행 트리거가 돌지 않아 change_log에는 넣은 행(INSERT)만 남는다
 * - 끝에 표별 행 수를 돌려준다 (SQL Editor 결과 칸에 보인다)
 */
import type { GameDataRows, TableName } from './rows.ts';
import { COLUMNS, TABLES } from './rows.ts';

/** SQL 값. 문자열은 작은따옴표를 겹쳐 쓴다 (standard_conforming_strings — 역슬래시는 그대로) */
export function sqlLiteral(value: unknown): string {
	if (value === null || value === undefined) return 'null';
	if (typeof value === 'number') {
		if (!Number.isFinite(value)) throw new Error(`SQL에 쓸 수 없는 숫자: ${value}`);
		return String(value);
	}
	if (typeof value === 'boolean') return value ? 'true' : 'false';
	if (typeof value === 'string') return `'${value.replaceAll("'", "''")}'`;
	// json 열 (datasets.data): 글자 그대로 저장되므로 키 순서가 남는다
	return sqlLiteral(JSON.stringify(value));
}

function insert<T extends TableName>(table: T, rows: GameDataRows[T]): string {
	const columns = COLUMNS[table] as readonly string[];
	const values = (rows as unknown as readonly Record<string, unknown>[]).map(
		(row) => `  (${columns.map((c) => sqlLiteral(row[c])).join(', ')})`
	);
	return `insert into public.${table} (${columns.join(', ')}) values\n${values.join(',\n')};`;
}

export function seedSql(rows: GameDataRows, header: readonly string[] = []): string {
	const out: string[] = [
		...header.map((line) => `-- ${line}`),
		'-- Supabase SQL Editor에서 통째로 실행한다. 게임 데이터 표 9개를 비우고 다시 넣는다 (docs/006 7-1).',
		'-- 표를 비우는 문장이 있어 SQL Editor가 확인을 물으면 그대로 실행한다.',
		'',
		'begin;',
		'',
		`truncate table ${[...TABLES]
			.reverse()
			.map((t) => `public.${t}`)
			.join(', ')};`,
		''
	];
	for (const table of TABLES) {
		if (rows[table].length > 0) out.push(insert(table, rows[table]), '');
	}
	out.push('commit;', '');
	out.push(
		TABLES.map(
			(t) => `select ${sqlLiteral(t)} as "표", count(*) as "행" from public.${t}`
		).join('\nunion all\n') + ';'
	);
	return `${out.join('\n')}\n`;
}
