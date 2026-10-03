/**
 * 요소를 문서 맨 끝(body)으로 옮긴다 — 알림처럼 화면 전체 위에 떠야 하는 것에 쓴다.
 *
 * 왜 필요한가 (2026-10-02): 왼쪽 목록(aside)은 sticky라 자기만의 겹침 층을 만든다.
 * 그 안에서 띄운 알림은 z-index가 아무리 높아도 그 층 안에서만 높아서, 오른쪽 본문 아래에 깔려 보이지 않았다.
 * body로 옮기면 어느 부품 안에서 띄우든 같은 층에서 맨 위에 뜬다.
 */
export function portal(node: HTMLElement) {
	document.body.appendChild(node);
	return {
		destroy() {
			node.remove();
		}
	};
}
