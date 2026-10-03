// 사용 통계 (Umami, 공개 준비 5번, 2026-10-03).
// 코드 쪽 정본은 아래의 AnalyticsEvent 목록이다. 이벤트별 수집 목적·판단 기준은 레포 밖의 개인 기록 문서에 둔다
// (이벤트를 더하거나 바꾸면 그 문서도 함께 고친다).
//
// 원칙
// - 입력값·결과 수치·공유/백업 링크의 내용은 담지 않는다. "어느 계산기, 어느 칸" 같은 위치만
// - 스크립트는 배포된 사이트(vanitas.live)에서만 불린다 (+layout.svelte). 개발 서버·미리보기 배포에서는
//   window.umami가 없어서 track이 아무것도 하지 않는다
// - 브라우저의 "추적 안 함(Do Not Track)"을 켠 방문은 Umami가 세지 않는다 (data-do-not-track)

declare global {
	interface Window {
		umami?: { track: (event: string, data?: Record<string, string>) => void };
	}
}

export type AnalyticsEvent =
	| 'calc-used'
	| 'help-open'
	| 'pity-banner'
	| 'levelup-mode'
	| 'income-view'
	| 'chart-cursor'
	| 'share-copy'
	| 'shared-open'
	| 'shared-keep'
	| 'shared-back'
	| 'backup-create'
	| 'backup-import'
	| 'reset'
	| 'reset-undo';

/** 이벤트 하나를 보낸다. 통계 스크립트가 없거나 실패해도 화면에는 영향이 없다 */
export function track(event: AnalyticsEvent, data?: Record<string, string>) {
	try {
		window.umami?.track(event, data);
	} catch {
		// 통계는 부가 기능 — 실패해도 조용히 넘어간다
	}
}

/** 화면 주소(route id)를 계산기 이름으로: '/levelup' → 'levelup', '/' → 'home' */
export function calcName(routeId: string | null | undefined): string {
	return routeId?.replace(/^\//, '') || 'home';
}
