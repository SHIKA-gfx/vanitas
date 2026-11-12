import { describe, expect, it } from 'vitest';
import type { GameDataRows } from './rows';
import { TABLES } from './rows';
import { seedSql, sqlLiteral } from './seed-sql';

describe('넣기 SQL (docs/006 7-1)', () => {
	it('값: 작은따옴표는 겹치고 역슬래시는 그대로, null·숫자', () => {
		expect(sqlLiteral("it's")).toBe("'it''s'");
		expect(sqlLiteral('a\\nb')).toBe("'a\\nb'");
		expect(sqlLiteral(null)).toBe('null');
		expect(sqlLiteral(200)).toBe('200');
		expect(() => sqlLiteral(Number.POSITIVE_INFINITY)).toThrow();
	});

	it('json 열은 키 순서를 지킨 글자로 넣는다', () => {
		expect(sqlLiteral({ meta: 1, $schema: 'x', id: "a'b" })).toBe(
			`'{"meta":1,"$schema":"x","id":"a''b"}'`
		);
	});

	it('한 트랜잭션: 9개 표를 비우고, 행이 있는 표만 넣고, 끝에 행 수를 센다', () => {
		const rows = Object.fromEntries(TABLES.map((t) => [t, []])) as unknown as GameDataRows;
		rows.sources.push({
			id: '1',
			publisher: 'p',
			title: 't',
			published: null,
			url: null,
			retrieved_at: null,
			tier: 'official',
			note: null
		});
		const sql = seedSql(rows, ['머리말']);
		expect(sql.startsWith('-- 머리말\n')).toBe(true);
		expect(sql).toMatch(/begin;\n\ntruncate table public\.datasets, .*public\.sources;/);
		for (const t of TABLES) expect(sql).toContain(`public.${t}`);
		expect(sql).toContain(
			"insert into public.sources (id, publisher, title, published, url, retrieved_at, tier, note) values\n  ('1', 'p', 't', null, null, null, 'official', null);"
		);
		expect(sql).not.toContain('insert into public.students');
		expect(sql.indexOf('commit;')).toBeLessThan(sql.indexOf('union all'));
	});
});
