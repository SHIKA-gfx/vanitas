/*
 * 누름 효과 (2026-10-23, 디자인 문서 5-19 "누름 효과", 8-2 F) — 블루 아카이브의 터치 반응에서.
 * 2026-10-24 다시 맞춤 (게임 화면 캡처와 비교): 흰색·하늘색 조각이 흩어지는 모양이 아니라
 *   - 원: 하늘색~파랑의 반투명 바탕에, 테두리가 흰색으로 빛난다. 지름 64px (36px에서 키움)
 *   - 삼각형 여섯: 흰색과 파랑이 번갈아, 원 테두리 바로 바깥에 꼭짓점을 바깥으로 향해 붙었다가 조금 밀려나며 사라진다
 *   - 460ms (320ms에서 늘림 — 원칙 6의 350ms보다 길지만, 누른 자리를 확인하는 반응이라 사용자 결정으로 예외)
 *
 * - 대상: 링크, 버튼, 모드 전환·체크박스 줄(라벨). 입력칸·목록 선택칸에서는 생기지 않는다 (입력 흐름을 건드리지 않는다)
 * - click에서 띄운다: 터치 스크롤 중에는 click이 오지 않아 스크롤하다 잘못 터지지 않는다.
 *   키보드로 누르면(detail === 0) 요소 가운데에서
 * - 손가락·마우스를 따라오는 흔적은 만들지 않는다 (5-18 금지: 커서 추적 장식)
 * - 동시에 3개까지. 줄인 움직임·강제 색상 모드에서는 띄우지 않는다. 장식이라 화면 낭독기에 알리지 않는다
 * - 효과 층은 화면 전환 때 이름(vt-burst)을 고정해, 누른 직후 화면이 바뀌어도 새 화면 위에서 끝까지 돈다
 * - transform·opacity만 움직인다 (Web Animations). 빛 번짐(filter)은 화면 전체 층이 아니라 효과 하나(작은 상자)에만 건다
 */
import { reducedMotion } from '$lib/motion';

const TARGETS =
	'a[href], button:not(:disabled), [role="button"], label:has(input[type="checkbox"]), label:has(input[type="radio"])';
const NEVER = 'input:not([type="checkbox"]):not([type="radio"]), select, textarea, [data-no-burst]';

const DURATION = 460;
const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
/** 원 반지름 (지름 64px) */
const RING = 32;
const MAX_ACTIVE = 3;
/** 라벨을 누르면 브라우저가 안의 체크박스에도 click을 한 번 더 보낸다 → 이 안의 두 번째는 무시 */
const DEDUPE_MS = 40;

/** 삼각형 여섯: 흰색과 파랑이 번갈아 (게임 화면처럼). 크기(한 변)와 원 바깥으로 밀려나는 거리 */
const SHARDS = [
	{ color: '#ffffff', size: 12, out: 10 },
	{ color: 'var(--color-brand)', size: 10, out: 14 },
	{ color: '#ffffff', size: 10, out: 12 },
	{ color: 'var(--color-brand)', size: 12, out: 10 },
	{ color: '#ffffff', size: 11, out: 14 },
	{ color: 'var(--color-cyan)', size: 9, out: 12 }
];

export function installTapBurst(): () => void {
	const layer = document.createElement('div');
	layer.setAttribute('aria-hidden', 'true');
	layer.style.cssText =
		'position:fixed;inset:0;pointer-events:none;z-index:60;overflow:hidden;contain:strict;' +
		'view-transition-name:vt-burst';
	document.body.append(layer);

	const forcedColors = window.matchMedia('(forced-colors: active)');
	let active = 0;
	let lastAt = 0;

	function onClick(e: MouseEvent) {
		if (reducedMotion() || forcedColors.matches) return;
		if (!(e.target instanceof Element)) return;
		if (e.target.closest(NEVER) && !e.target.closest('label')) return;
		const target = e.target.closest(TARGETS);
		if (!target) return;
		if (e.timeStamp - lastAt < DEDUPE_MS) return;
		lastAt = e.timeStamp;
		if (active >= MAX_ACTIVE) return;

		let x = e.clientX;
		let y = e.clientY;
		if (e.detail === 0) {
			const r = target.getBoundingClientRect();
			x = r.left + r.width / 2;
			y = r.top + r.height / 2;
		}
		burst(x, y);
	}

	function burst(x: number, y: number) {
		active += 1;
		const group = document.createElement('div');
		group.style.cssText =
			`position:absolute;left:${x}px;top:${y}px;width:0;height:0;` +
			'filter:drop-shadow(0 0 3px rgb(255 255 255 / 0.9)) drop-shadow(0 0 6px rgb(0 214 250 / 0.5))';

		// 원: 하늘색~파랑 반투명 바탕 + 흰 테두리 빛
		const ring = document.createElement('div');
		ring.style.cssText =
			`position:absolute;left:${-RING}px;top:${-RING}px;width:${RING * 2}px;height:${RING * 2}px;` +
			'border-radius:50%;box-sizing:border-box;border:2.5px solid rgb(255 255 255 / 0.95);' +
			'background:radial-gradient(circle, rgb(124 208 255 / 0.16) 0%, rgb(18 136 248 / 0.3) 60%, ' +
			'rgb(124 208 255 / 0.55) 86%, rgb(255 255 255 / 0.75) 100%);' +
			'box-shadow:0 0 8px 1px rgb(255 255 255 / 0.95), 0 0 18px 4px rgb(124 208 255 / 0.7), ' +
			'inset 0 0 10px 2px rgb(255 255 255 / 0.55)';
		group.append(ring);
		const animations: Animation[] = [
			ring.animate(
				[
					{ transform: 'scale(0.35)', opacity: 0.3, offset: 0 },
					{ transform: 'scale(1)', opacity: 1, offset: 0.35 },
					{ transform: 'scale(1.05)', opacity: 1, offset: 0.62 },
					{ transform: 'scale(1.12)', opacity: 0, offset: 1 }
				],
				{ duration: DURATION, easing: EASE, fill: 'forwards' }
			)
		];

		// 삼각형: 원 테두리 바로 바깥에서 꼭짓점을 바깥으로 향하고, 조금 밀려나며 사라진다. 60° 간격, 매번 조금씩 비튼다
		const turn = Math.random() * 60;
		SHARDS.forEach((s, i) => {
			const angle = turn + i * 60 + (Math.random() * 24 - 12);
			const spin = Math.random() * 40 - 20;
			const h = (s.size * Math.sqrt(3)) / 2;
			const shard = document.createElement('div');
			shard.style.cssText =
				`position:absolute;left:${-s.size / 2}px;top:${-h / 2}px;width:${s.size}px;height:${h}px;` +
				`background:${s.color};clip-path:polygon(50% 0,100% 100%,0 100%)`;
			group.append(shard);
			// rotate(각도) → 그 방향으로 이동 → 꼭짓점(위쪽)이 바깥을 보게 90° 더 돌린다
			const at = (r: number, sc: number, extra = 0) =>
				`rotate(${angle}deg) translateX(${r}px) rotate(${90 + extra}deg) scale(${sc})`;
			animations.push(
				shard.animate(
					[
						{ transform: at(RING * 0.55, 0.4), opacity: 0, offset: 0 },
						{ transform: at(RING + 6, 1), opacity: 1, offset: 0.35 },
						{ transform: at(RING + 6 + s.out * 0.6, 1, spin * 0.6), opacity: 1, offset: 0.65 },
						{ transform: at(RING + 6 + s.out, 0.8, spin), opacity: 0, offset: 1 }
					],
					{ duration: DURATION, easing: EASE, fill: 'forwards' }
				)
			);
		});

		layer.append(group);
		Promise.all(animations.map((a) => a.finished))
			.catch(() => {})
			.finally(() => {
				group.remove();
				active -= 1;
			});
	}

	document.addEventListener('click', onClick);
	return () => {
		document.removeEventListener('click', onClick);
		layer.remove();
	};
}
