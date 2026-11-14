/**
 * 이 화면을 연 배포(=지금 사이트)에 들어 있는 데이터 파일 10개.
 * DB와 비교해 "반영 전"을 알린다 — 사이트 화면들이 쓰는 것과 같은 파일이라 받는 양이 거의 늘지 않는다
 */
import sources from '../../../data/sources.json';
import schedule from '../../../data/ko/schedule.json';
import students from '../../../data/ko/students.json';
import incomeSources from '../../../data/ko/income-sources.json';
import apConfig from '../../../data/ko/ap-config.json';
import gameConfig from '../../../data/ko/game-config.json';
import bannerTypes from '../../../data/ko/banner-types.json';
import poolSizes from '../../../data/ko/pool-sizes.json';
import levelTable from '../../../data/shared/level-table.json';
import cafeRanks from '../../../data/shared/cafe-ranks.json';
import type { DocPath } from './doc-sections';

export const SITE_FILES: Readonly<Record<DocPath, Record<string, unknown>>> = {
	'sources.json': sources,
	'ko/schedule.json': schedule,
	'ko/students.json': students,
	'ko/income-sources.json': incomeSources,
	'ko/ap-config.json': apConfig,
	'ko/game-config.json': gameConfig,
	'ko/banner-types.json': bannerTypes,
	'ko/pool-sizes.json': poolSizes,
	'shared/level-table.json': levelTable,
	'shared/cafe-ranks.json': cafeRanks
};
