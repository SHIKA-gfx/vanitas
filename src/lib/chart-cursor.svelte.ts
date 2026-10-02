// 그래프 커서: 마우스로 훑거나(데스크톱) 손가락으로 끌면(모바일) 그 위치의 점을 고른다.
// 키보드로는 방향키(1%, Shift 10%)·Home·End로 옮기고 Esc로 지운다.
// 그래프(SVG)는 role="slider"로 두고, 고른 점의 내용을 aria-valuetext로 알린다.

import { keyStep, nearestIndex, viewBoxX } from './chart';

type SvgPointerEvent = PointerEvent & { currentTarget: SVGSVGElement };

export class ChartCursor {
	/** 고른 점의 위치 (그래프 점 배열의 인덱스). 없으면 null */
	index: number | null = $state(null);

	#days: () => number[];
	#dayAt: (viewX: number) => number;
	#width: number;

	/**
	 * @param days 그래프 점들의 x값(날짜) — 오름차순
	 * @param dayAt viewBox x 좌표 → 날짜
	 * @param width viewBox 너비
	 */
	constructor(days: () => number[], dayAt: (viewX: number) => number, width: number) {
		this.#days = days;
		this.#dayAt = dayAt;
		this.#width = width;
	}

	#pick(svg: SVGSVGElement, clientX: number) {
		const i = nearestIndex(this.#days(), this.#dayAt(viewBoxX(svg, clientX, this.#width)));
		this.index = i < 0 ? null : i;
	}

	onpointerdown = (e: SvgPointerEvent) => {
		this.#pick(e.currentTarget, e.clientX);
		// 손가락·펜은 그래프 밖으로 나가도 끄는 동안 계속 따라오게
		if (e.pointerType !== 'mouse') e.currentTarget.setPointerCapture(e.pointerId);
	};

	onpointermove = (e: SvgPointerEvent) => {
		// 마우스는 올리기만 해도, 손가락은 누른 채 끌 때만
		if (e.pointerType === 'mouse' || e.buttons > 0) this.#pick(e.currentTarget, e.clientX);
	};

	onpointerleave = (e: SvgPointerEvent) => {
		// 마우스는 벗어나면 지운다. 손가락은 뗀 뒤에도 마지막 값을 남긴다
		if (e.pointerType === 'mouse') this.index = null;
	};

	onkeydown = (e: KeyboardEvent) => {
		const last = this.#days().length - 1;
		if (last < 0) return;
		const step = keyStep(last + 1, e.shiftKey);
		const now = this.index ?? 0;
		let next: number;
		switch (e.key) {
			case 'ArrowRight':
			case 'ArrowUp':
				next = Math.min(last, now + step);
				break;
			case 'ArrowLeft':
			case 'ArrowDown':
				next = Math.max(0, now - step);
				break;
			case 'Home':
				next = 0;
				break;
			case 'End':
				next = last;
				break;
			case 'Escape':
				this.index = null;
				return;
			default:
				return;
		}
		e.preventDefault();
		this.index = next;
	};

	onblur = () => {
		this.index = null;
	};
}
