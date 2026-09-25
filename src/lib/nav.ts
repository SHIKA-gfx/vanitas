// 사이트의 화면 목록. 내비게이션(AppNav)과 홈 화면이 같은 목록을 쓴다.
// 새 화면이 완성되면 ready만 true로 바꾼다.

import { m } from '$lib/paraglide/messages.js';

export interface SiteSection {
	/** 로케일 접두어 없는 경로. page.route.id와 같은 형태 */
	path: string;
	/** 데스크톱 목록·홈 카드 제목 */
	label: () => string;
	/** 모바일 탭바 라벨 (두 줄로 접히지 않게 짧게) */
	short: () => string;
	/** 홈 카드 설명 한 줄 */
	description: () => string;
	/** false면 아직 없는 화면. 링크 대신 "준비 중"으로 보여준다 */
	ready: boolean;
}

// 순서가 곧 화면 순서다 (디자인 문서 5-4: 모든 화면에서 같게)
export const sections: SiteSection[] = [
	{
		path: '/planner',
		label: m.nav_planner,
		short: m.nav_planner_short,
		description: m.home_planner_description,
		ready: false
	},
	{
		path: '/pity',
		label: m.nav_pity,
		short: m.nav_pity_short,
		description: m.home_pity_description,
		ready: true
	},
	{
		path: '/levelup',
		label: m.nav_levelup,
		short: m.nav_levelup_short,
		description: m.home_levelup_description,
		ready: true
	},
	{
		path: '/income',
		label: m.nav_income,
		short: m.nav_income_short,
		description: m.home_income_description,
		ready: false
	}
];
