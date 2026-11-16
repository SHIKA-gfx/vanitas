/**
 * 문서 편집 화면 안에서 함께 쓰는 것
 * - 잘못 적은 칸 목록 (있으면 저장이 잠긴다). 칸 하나가 숫자 자리에 글자를 받으면 데이터는 바꾸지 않고 여기에 이름을 올린다
 * - 고치는 문서의 경로 — 빈 목록에 첫 줄을 만들 틀(ROW_TEMPLATES)을 "경로:칸"으로 찾는다
 */
import { getContext, setContext } from 'svelte';
import { SvelteSet } from 'svelte/reactivity';

const KEY = Symbol('doc-invalid');

export function provideInvalidSet(): SvelteSet<string> {
	const set = new SvelteSet<string>();
	setContext(KEY, set);
	return set;
}

export function getInvalidSet(): SvelteSet<string> | undefined {
	return getContext<SvelteSet<string> | undefined>(KEY);
}

const PATH_KEY = Symbol('doc-path');

export function provideDocPath(path: string) {
	setContext(PATH_KEY, path);
}

export function getDocPath(): string | undefined {
	return getContext<string | undefined>(PATH_KEY);
}
