/*
 * 누름 효과 (2026-10-23, 디자인 문서 5-19 "누름 효과", 8-2 F) — 블루 아카이브의 터치 반응에서.
 * 누른 자리에서 원이 퍼지고, 작은 정삼각형 다섯 개가 72° 간격으로 튀어 나가며 사라진다. 전체 320ms.
 *
 * - 대상: 링크, 버튼, 모드 전환·체크박스 줄(라벨). 입력칸·목록 선택칸에서는 생기지 않는다 (입력 흐름을 건드리지 않는다)
 * - click에서 띄운다: 터치 스크롤 중에는 click이 오지 않아 스크롤하다 잘못 터지지 않는다.
 *   키보드로 누르면(detail === 0) 요소 가운데에서
 * - 손가락·마우스를 따라오는 흔적은 만들지 않는다 (5-18 금지: 커서 추적 장식)
 * - 동시에 3개까지. 줄인 움직임·강제 색상 모드에서는 띄우지 않는다. 장식이라 화면 낭독기에 알리지 않는다
 * - 효과 층은 화면 전환 때 이름(vt-burst)을 고정해, 누른 직후 화면이 바뀌어도 새 화면 위에서 끝까지 돈다
 * - transform·opacity만 움직인다 (Web Animations)
 */
import { reducedMotion } from '$lib/motion';

const TARGETS =
	'a[href], button:not(:disabled), [role="button"], label:has(input[type="checkbox"]), label:has(input[type="radio"])';
const NEVER = 'input:not([type="checkbox"]):not([type="radio"]), select, textarea, [data-no-burst]';

const DURATION = 320;
const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
const MAX_ACTIVE = 3;
/** 라벨을 누르면 브라우저가 안의 체크박스에도 click을 한 번 더 보낸다 → 이 안의 두 번째는 무시 */
const DEDUPE_MS = 40;

/**
 * 삼각형 다섯: 색과 날아가는 거리. 흰 판 위에서도 보이도록 하늘색 계열을 섞는다
 * (처음엔 흰색 위주였는데 흰 판·흰 조각 위에서 거의 보이지 않았다)
 */
const SHARDS = [
	{ color: 'var(--color-sky)', distance: 24 },
	{ color: 'var(--color-brand)', distance: 28 },
	{ color: '#ffffff', distance: 22 },
	{ color: 'var(--color-cyan)', distance: 26 },
	{ color: 'var(--color-sky)', distance: 24 }
];

export function installTapBurst(): () => void {
	const layer = document.createElement('div');
	layer.setAttribute('aria-hidden', 'true');
	layer.style.cssText =
		'position:fixed;inset:0;pointer-events:none;z-index:60;overflow:hidden;contain:strict;' +
		'view-transition-name:vt-burst;filter:drop-shadow(0 0 3px rgb(0 214 250 / 0.9))';
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
		group.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:0;height:0`;

		const ring = document.createElement('div');
		ring.style.cssText =
			'position:absolute;left:-18px;top:-18px;width:36px;height:36px;border-radius:50%;' +
			'border:2px solid var(--color-sky);box-sizing:border-box;' +
			'background:radial-gradient(closest-side,rgb(255 255 255 / 0.9),rgb(124 208 255 / 0.25))';
		group.append(ring);
		const animations: Animation[] = [
			ring.animate(
				[
					{ transform: 'scale(0.2)', opacity: 1 },
					{ transform: 'scale(1)', opacity: 0 }
				],
				{ duration: DURATION, easing: EASE, fill: 'forwards' }
			)
		];

		// 72° 간격, 매번 조금씩 비튼다
		const turn = Math.random() * 72;
		SHARDS.forEach((s, i) => {
			const angle = ((turn + i * 72 + (Math.random() * 30 - 15)) * Math.PI) / 180;
			const dx = Math.cos(angle) * s.distance;
			const dy = Math.sin(angle) * s.distance;
			const spin = 60 + Math.random() * 60;
			const shard = document.createElement('div');
			shard.style.cssText =
				'position:absolute;left:-4px;top:-4px;width:8px;height:7px;' +
				`background:${s.color};clip-path:polygon(50% 0,100% 100%,0 100%)`;
			group.append(shard);
			animations.push(
				shard.animate(
					[
						{ transform: 'translate(0, 0) rotate(0deg) scale(1)', opacity: 1 },
						{
							transform: `translate(${dx}px, ${dy}px) rotate(${spin}deg) scale(0.6)`,
							opacity: 0
						}
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
