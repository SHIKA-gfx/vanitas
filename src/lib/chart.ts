// SVG 그래프 공용 도우미. 그래프 위를 마우스로 훑거나 손가락으로 끌면
// 그 위치의 값을 보여주는 기능(레벨 추이·잔고 추이)에 쓴다.

/** 포인터의 화면 좌표(clientX)를 SVG viewBox 안의 x 좌표로 바꾼다 */
export function viewBoxX(svg: SVGSVGElement, clientX: number, viewBoxWidth: number): number {
	const rect = svg.getBoundingClientRect();
	if (rect.width === 0) return 0;
	return ((clientX - rect.left) / rect.width) * viewBoxWidth;
}

/**
 * 오름차순 배열에서 target에 가장 가까운 값의 위치 (이진 탐색, O(log n)).
 * 그래프의 점은 날짜 순서라 정렬돼 있고, 점이 수천 개(최대 10년치)여도 포인터를 따라 즉시 찾는다.
 */
export function nearestIndex(sorted: number[], target: number): number {
	if (sorted.length === 0) return -1;
	let lo = 0;
	let hi = sorted.length - 1;
	while (lo < hi) {
		const mid = (lo + hi) >> 1;
		if (sorted[mid] < target) lo = mid + 1;
		else hi = mid;
	}
	// lo는 target 이상인 첫 값. 바로 앞 값이 더 가까울 수 있다
	if (lo > 0 && target - sorted[lo - 1] <= sorted[lo] - target) return lo - 1;
	return lo;
}

/** 방향키로 커서를 옮길 때의 한 칸: 그래프 길이의 1% (Shift는 10%), 최소 1 */
export function keyStep(length: number, large: boolean): number {
	return Math.max(1, Math.round(length * (large ? 0.1 : 0.01)));
}
