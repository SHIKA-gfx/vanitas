/*
 * 곡선 보간 (2026-10-23, 디자인 문서 5-18 "그래프", 8-2 F2).
 * 값이 바뀌면 곡선을 다시 그리지 않고 모양이 옮겨 간다 (360ms).
 *
 * 방법: 화면 좌표의 꺾은선을 자기 가로 범위 안에서 같은 간격의 점 N개로 다시 뽑고, 그 좌표 배열을 Tween으로 보간한다.
 * 곡선마다 점 개수·가로축 범위(천장까지 연차, 날짜 수)가 값과 함께 바뀌므로, 같은 개수로 맞춰야 이어서 옮길 수 있다.
 * - 옮겨 가는 동안만 다시 뽑은 선을 쓰고, 끝나면 원래 선으로 돌아간다 (다시 뽑으면 수직으로 뛰는 자리가 몇 px 기울어진다)
 * - 입력칸에 글자를 넣는 중이거나 줄인 움직임 설정이면 바로 바꾼다 (숫자 굴림과 같은 규칙)
 * - 모양이 그대로면 아무것도 하지 않는다
 * - CSS의 d 속성 전환은 브라우저마다 달라 쓰지 않는다 (처음 5-18에 적은 "transform으로"는 이 방법으로 바꿨다)
 *
 * 컴포넌트를 처음 그릴 때 만든다 (생성자 안의 $effect).
 */
import { untrack } from 'svelte';
import { Tween } from 'svelte/motion';
import { cubicOut } from 'svelte/easing';
import { MOTION, isTyping, reducedMotion } from '$lib/motion';

export type Pt = readonly [number, number];

/** 다시 뽑는 점 개수. 그래프 폭(약 270)에서 4px 간격 */
const N = 64;

/** 가로 범위 안에서 같은 간격으로 N개를 다시 뽑아 [x0, y0, x1, y1, ...]로 */
function resample(pts: readonly Pt[]): number[] {
	const out: number[] = [];
	if (pts.length === 0) return out;
	if (pts.length === 1) {
		for (let i = 0; i < N; i++) out.push(pts[0][0], pts[0][1]);
		return out;
	}
	const x0 = pts[0][0];
	const x1 = pts[pts.length - 1][0];
	let j = 0;
	for (let i = 0; i < N; i++) {
		if (i === N - 1) {
			out.push(pts[pts.length - 1][0], pts[pts.length - 1][1]);
			break;
		}
		const x = x0 + (x1 - x0) * (i / (N - 1));
		while (j < pts.length - 2 && pts[j + 1][0] <= x) j++;
		const [ax, ay] = pts[j];
		const [bx, by] = pts[j + 1];
		const t = bx === ax ? 0 : Math.min(1, Math.max(0, (x - ax) / (bx - ax)));
		out.push(x, ay + (by - ay) * t);
	}
	return out;
}

function same(a: readonly Pt[], b: readonly Pt[]): boolean {
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) {
		if (Math.abs(a[i][0] - b[i][0]) > 0.05 || Math.abs(a[i][1] - b[i][1]) > 0.05) return false;
	}
	return true;
}

const toString = (pts: readonly Pt[]) =>
	pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

export class CurveMorph {
	#tween = new Tween<number[]>([], { duration: MOTION.curve, easing: cubicOut });
	#morphing = $state(false);
	#last: readonly Pt[] | null = null;
	#source: () => readonly Pt[];

	constructor(source: () => readonly Pt[]) {
		this.#source = source;
		$effect(() => {
			const pts = this.#source();
			untrack(() => this.#update(pts));
		});
	}

	#update(pts: readonly Pt[]) {
		const prev = this.#last;
		this.#last = pts;
		if (!prev || prev.length === 0 || pts.length === 0 || same(prev, pts)) return;
		if (reducedMotion() || isTyping()) {
			this.#morphing = false;
			return;
		}
		const from = this.#morphing ? this.#tween.current : resample(prev);
		const to = resample(pts);
		this.#morphing = true;
		this.#tween.set(from, { duration: 0 });
		this.#tween.set(to).then(() => {
			if (this.#tween.target === to) this.#morphing = false;
		});
	}

	/** polyline의 points — 옮겨 가는 중이면 보간한 선, 아니면 원래 선 */
	get points(): string {
		if (!this.#morphing) return toString(this.#source());
		const a = this.#tween.current;
		let s = '';
		for (let i = 0; i + 1 < a.length; i += 2) s += `${a[i].toFixed(1)},${a[i + 1].toFixed(1)} `;
		return s.trimEnd();
	}
}

/**
 * 숫자 하나(예: 보유 연차 표시선의 x)를 곡선과 같은 박자로 옮긴다. 곡선이 옮겨 가는 동안 혼자 먼저 뛰지 않게
 */
export class ValueMorph {
	#tween: Tween<number>;
	#source: () => number;
	#last: number;

	constructor(source: () => number) {
		this.#source = source;
		this.#last = untrack(source);
		this.#tween = new Tween(this.#last, { duration: MOTION.curve, easing: cubicOut });
		$effect(() => {
			const v = this.#source();
			untrack(() => {
				if (v === this.#last) return;
				this.#last = v;
				const instant = reducedMotion() || isTyping();
				this.#tween.set(v, instant ? { duration: 0 } : undefined);
			});
		});
	}

	get current(): number {
		return this.#tween.current;
	}
}
