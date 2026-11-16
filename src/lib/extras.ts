// 부가기능 목록 (docs/008 4-3). 허브(/extra)와 홈의 모바일 진입점이 같은 목록을 쓴다.
// 계산기·플래너와 별개인 서브 콘텐츠. 게임 규칙 값이 아니라 사이트 구성이라 코드에 둔다.
//
// 새 콘텐츠를 더할 때: 이 배열에 한 줄 + src/routes/extra/<이름>/ 폴더 하나.
// 화면이 완성되기 전에는 ready: false — 허브에 "준비 중" 카드로 보이고 링크가 없다 (nav.ts와 같은 방식).
// 아직 허브에 보이지 않게 할 콘텐츠는 배열에 넣지 않는다 (학생이랑 더 친해지기, 결정 D9).

import { m } from '$lib/paraglide/messages.js';
import type { NavIconName } from '$lib/icons/NavIcon.svelte';

/** 허브 주소 (로케일 접두어 없이) */
export const EXTRA_HUB_PATH = '/extra';

export interface Extra {
	/** 통계(extra-open)에 담는 이름 */
	id: 'story';
	/** 로케일 접두어 없는 경로. page.route.id와 같은 형태 */
	path: string;
	title: () => string;
	/** 허브 카드 설명 한 줄 */
	summary: () => string;
	icon: NavIconName;
	/** false면 아직 없는 화면. 링크 대신 "준비 중" */
	ready: boolean;
}

export const extras: Extra[] = [
	{
		id: 'story',
		path: '/extra/story',
		title: m.extra_story_title,
		summary: m.extra_story_summary,
		icon: 'story',
		ready: true
	}
];
