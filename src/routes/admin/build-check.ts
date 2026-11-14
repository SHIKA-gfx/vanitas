/**
 * 빌드 검사를 브라우저에서 (docs/006 6-3-3, ④-4).
 *
 * 빌드가 돌리는 validate.py를 **그대로** 브라우저의 Python(Pyodide)으로 돌린다 — 검사 규칙을 TS로 옮기지 않으므로
 * 관리자 화면의 검사와 빌드의 검사가 어긋날 수 없다. 데이터는 DB에서 내보낸 파일(rowsToFiles)과 같은 것을 쓴다.
 *
 * - Pyodide는 처음 검사할 때 한 번만 받는다 (약 12MB, jsDelivr — 브라우저가 기억한다). 관리자 화면에서만 쓴다
 * - validate.py와 logs/daily-income.csv는 빌드에 글자로 들어간다 (?raw) — 레포의 그 파일이다
 * - 고치기 전(지금 DB)과 고친 뒤를 둘 다 돌려 **새로 생긴** 오류·경고만 고침 탓으로 본다
 */
import validatePy from '../../../validate.py?raw';
import dailyIncomeCsv from '../../../logs/daily-income.csv?raw';
import { env } from '$env/dynamic/public';
import type { DataFiles } from '$lib/data/db/convert';

/** Pyodide 받는 곳. 로컬 시험은 PUBLIC_PYODIDE_BASE로 바꾼다 */
const PYODIDE_VERSION = '314.0.7';
const DEFAULT_BASE = `https://cdn.jsdelivr.net/npm/pyodide@${PYODIDE_VERSION}/`;

export interface CheckResult {
	errors: string[];
	warnings: string[];
}

export interface CheckDiff {
	/** 고친 뒤 새로 생긴 오류 — 있으면 저장하지 않는다 */
	newErrors: string[];
	newWarnings: string[];
	/** 고친 뒤 사라진 오류·경고 */
	resolved: string[];
	/** 고치기 전에도 있던 것 */
	unchanged: string[];
	after: CheckResult;
}

interface PyProxy {
	set(key: string, value: unknown): void;
	get(key: string): unknown;
	destroy(): void;
}
interface Pyodide {
	FS: {
		mkdirTree(path: string): void;
		writeFile(path: string, data: string): void;
	};
	toPy(value: unknown): PyProxy;
	runPython(code: string, options?: { globals?: PyProxy }): unknown;
	setStdout(options: { batched: (s: string) => void }): void;
}

let loading: Promise<Pyodide> | null = null;

function loadPyodideOnce(): Promise<Pyodide> {
	loading ??= (async () => {
		const base = (env.PUBLIC_PYODIDE_BASE?.trim() || DEFAULT_BASE).replace(/\/?$/, '/');
		const mod = (await import(/* @vite-ignore */ `${base}pyodide.mjs`)) as {
			loadPyodide: (o: { indexURL: string }) => Promise<Pyodide>;
		};
		const py = await mod.loadPyodide({ indexURL: base });
		py.setStdout({ batched: () => {} }); // 요약 출력은 쓰지 않는다 (오류·경고 목록을 직접 읽는다)
		return py;
	})().catch((e: unknown) => {
		loading = null; // 다음에 다시 시도
		throw new Error(`검사 도구(Pyodide)를 받지 못했어요: ${(e as Error).message}`);
	});
	return loading;
}

const ROOT = '/vanitas';

/** 파일 묶음에 validate.py를 돌린다. 검사 중 Python 예외(형식이 크게 어긋난 데이터)는 오류 하나로 돌려준다 */
export async function runBuildCheck(files: DataFiles): Promise<CheckResult> {
	const py = await loadPyodideOnce();
	for (const dir of ['data/ko', 'data/shared', 'logs']) py.FS.mkdirTree(`${ROOT}/${dir}`);
	for (const [path, doc] of Object.entries(files)) {
		py.FS.writeFile(`${ROOT}/data/${path}`, JSON.stringify(doc));
	}
	py.FS.writeFile(`${ROOT}/logs/daily-income.csv`, dailyIncomeCsv);
	py.FS.writeFile(`${ROOT}/validate.py`, validatePy);

	// 돌릴 때마다 새 이름 공간 — 오류·경고 목록이 비어서 시작한다
	const ns = py.toPy({});
	ns.set('__file__', `${ROOT}/validate.py`);
	ns.set('__name__', 'vanitas_validate'); // if __name__ == "__main__"의 sys.exit를 피한다
	try {
		py.runPython(validatePy, { globals: ns });
		py.runPython('main()', { globals: ns });
		const read = (name: string) => {
			const list = ns.get(name) as { toJs(): string[]; destroy(): void };
			const out = list.toJs();
			list.destroy();
			return out;
		};
		return { errors: read('errors'), warnings: read('warnings') };
	} catch (e) {
		const message = (e as Error).message.trim().split('\n').slice(-1)[0];
		return { errors: [`검사 중 멈춤 (데이터 모양이 크게 어긋남): ${message}`], warnings: [] };
	} finally {
		ns.destroy();
	}
}

/** 고치기 전·뒤 결과 비교. 같은 문장이면 같은 문제로 본다 */
export function diffChecks(before: CheckResult, after: CheckResult): CheckDiff {
	const was = new Set([...before.errors, ...before.warnings]);
	const now = new Set([...after.errors, ...after.warnings]);
	return {
		newErrors: after.errors.filter((m) => !was.has(m)),
		newWarnings: after.warnings.filter((m) => !was.has(m)),
		resolved: [...was].filter((m) => !now.has(m)),
		unchanged: [...now].filter((m) => was.has(m)),
		after
	};
}
