// 게임 데이터 조회 창구.
// 계산기는 JSON 구조를 직접 알지 않고 이 파일의 함수만 사용한다.
// 2단계에서 DB로 옮길 때 이 파일만 교체하면 된다.

import gameConfigJson from '../../../data/ko/game-config.json';
import bannerTypesJson from '../../../data/ko/banner-types.json';
import poolSizesJson from '../../../data/ko/pool-sizes.json';
import apConfigJson from '../../../data/ko/ap-config.json';
import incomeSourcesJson from '../../../data/ko/income-sources.json';
import scheduleJson from '../../../data/ko/schedule.json';
import levelTableJson from '../../../data/shared/level-table.json';
import cafeRanksJson from '../../../data/shared/cafe-ranks.json';
import { addDays } from '$lib/game-date';
import type {
	ApConfig,
	BannerType,
	BannerTypesFile,
	CafeRank,
	CafeRanksFile,
	GameConfig,
	IncomePreset,
	IncomeSourcesFile,
	LevelTableFile,
	PointPool,
	PoolEntry,
	PoolSizesFile,
	RaidKind,
	RaidSeason,
	RateGroup,
	RateVariant,
	ScheduledEvent,
	ScheduleFile
} from './types';

/** 게임 데이터의 서버 구분. 로케일(UI 언어)과는 별개 축이다. */
export type ServerId = 'ko' | 'ja';

// 서버 공통 파일. 타입 단언 없이 대입해 JSON 구조가 타입과 어긋나면 빌드에서 걸린다.
const levelTable: LevelTableFile = levelTableJson;
const cafeRanks: CafeRanksFile = cafeRanksJson;

// 공통 파일도 서버별 세트에 넣어 둔다. 호출하는 쪽은 어느 파일이 공통인지 몰라도 된다.
const datasets = {
	ko: {
		config: gameConfigJson as unknown as GameConfig,
		banners: bannerTypesJson as unknown as BannerTypesFile,
		pools: poolSizesJson as unknown as PoolSizesFile,
		ap: apConfigJson as ApConfig,
		income: incomeSourcesJson as unknown as IncomeSourcesFile,
		schedule: scheduleJson as unknown as ScheduleFile,
		levels: levelTable,
		cafe: cafeRanks
	}
	// ja는 3단계에서 data/ja/ 를 추가한 뒤 여기에 한 줄 더한다.
};

function dataset(server: ServerId) {
	const set = datasets[server as 'ko'];
	if (!set) throw new Error(`아직 지원하지 않는 서버: ${server}`);
	return set;
}

export function getGameConfig(server: ServerId = 'ko'): GameConfig {
	return dataset(server).config;
}

export function listBannerTypes(koOnly = true, server: ServerId = 'ko'): BannerType[] {
	return dataset(server).banners.bannerTypes.filter((b) => !koOnly || b.availableInKo);
}

export function getBannerType(id: string, server: ServerId = 'ko'): BannerType {
	const found = dataset(server).banners.bannerTypes.find((b) => b.id === id);
	if (!found) throw new Error(`알 수 없는 배너 타입: ${id}`);
	return found;
}

export function getPointPool(id: string, server: ServerId = 'ko'): PointPool {
	const found = dataset(server).banners.pointPools.find((p) => p.id === id);
	if (!found) throw new Error(`알 수 없는 포인트 풀: ${id}`);
	return found;
}

/** 배너의 확률 그룹. 해당 variant가 없으면 undefined. */
export function getRateGroups(
	bannerId: string,
	variant: RateVariant = 'default',
	server: ServerId = 'ko'
): RateGroup[] | undefined {
	return getBannerType(bannerId, server).rateGroups[variant];
}

/** getPoolEntry / getPerUnitRate 의 공통 옵션 */
export interface PoolLookup {
	/** 이 날짜 이하의 스냅샷 중 가장 최신을 쓴다. 생략하면 전체에서 최신. */
	asOf?: string;
	/** true면 10회차 보정표의 풀을 찾는다. */
	tenthPull?: boolean;
	server?: ServerId;
}

/**
 * 지정 시점에 유효한 풀 크기.
 * asOf 이하의 스냅샷 중 가장 최신을 쓴다. 없으면 undefined.
 */
export function getPoolEntry(poolRef: string, options: PoolLookup = {}): PoolEntry | undefined {
	const { asOf, tenthPull = false, server = 'ko' } = options;
	const candidates = dataset(server)
		.pools.snapshots.filter((s) => !asOf || s.asOf <= asOf)
		.sort((a, b) => b.asOf.localeCompare(a.asOf));

	for (const snap of candidates) {
		const entry = tenthPull ? snap.tenthPullPools?.[poolRef] : snap.pools[poolRef];
		if (entry) return entry;
	}
	return undefined;
}

/**
 * 개별 학생 1명을 뽑을 확률(%).
 * 저장된 perUnitRate가 아니라 그룹 확률 ÷ 풀 크기로 계산한다 (파생값 비저장 원칙).
 * 풀 크기를 알 수 없으면 null.
 */
export function getPerUnitRate(group: RateGroup, options: PoolLookup = {}): number | null {
	if (group.poolRef === 'pickup') return group.rate; // 픽업은 1명이 그룹 전체를 차지
	if (group.poolRef === 'dynamic') return null;
	const entry = getPoolEntry(group.poolRef, options);
	return entry ? group.rate / entry.size : null;
}
// ---------------------------------------------------------------- 레벨·AP·카페

export function getLevelTable(server: ServerId = 'ko'): LevelTableFile {
	return dataset(server).levels;
}

/**
 * 레벨 level에 도달할 때 받는 보너스 AP.
 * 저장된 필드가 아니라 그 레벨의 apMax로 계산한다 (파생값 비저장 원칙). 1레벨은 0.
 */
export function getLevelUpBonusAp(level: number, server: ServerId = 'ko'): number {
	const row = getLevelTable(server).levels.find((r) => r.level === level);
	if (!row) throw new Error(`알 수 없는 레벨: ${level}`);
	return level === 1 ? 0 : row.apMax;
}

export function getApConfig(server: ServerId = 'ko'): ApConfig {
	return dataset(server).ap;
}

export function listCafeRanks(server: ServerId = 'ko'): CafeRank[] {
	return dataset(server).cafe.ranks;
}

export function getCafeRank(rank: number, server: ServerId = 'ko'): CafeRank {
	const found = listCafeRanks(server).find((r) => r.rank === rank);
	if (!found) throw new Error(`알 수 없는 카페 랭크: ${rank}`);
	return found;
}

/** 기본 생산만으로 만충까지 걸리는 시간 (cafe-ranks.json formulas.baseProductionPerHour) */
const CAFE_BASE_FILL_HOURS = 96;

/** 카페 시간당 AP 생산량. 쾌적도는 호출하는 쪽에서 범위를 확인한다. */
export function getCafeApPerHour(rank: CafeRank, comfort: number): number {
	return rank.maxStorage / CAFE_BASE_FILL_HOURS + comfort * rank.apPerComfort;
}

// ---------------------------------------------------------------- 청휘석 수급·일정

export function getIncomeSources(server: ServerId = 'ko'): IncomeSourcesFile {
	return dataset(server).income;
}

/** 플레이 강도 프리셋 목록 (_comment 같은 메모 키는 뺀다). 파일에 적힌 순서대로 */
export function listIncomePresets(server: ServerId = 'ko'): (IncomePreset & { id: string })[] {
	return Object.entries(getIncomeSources(server).presets)
		.filter((entry): entry is [string, IncomePreset] => typeof entry[1] === 'object')
		.map(([id, preset]) => ({ id, ...preset }));
}

export function getSchedule(server: ServerId = 'ko'): ScheduleFile {
	return dataset(server).schedule;
}

/**
 * until(게임 날짜)까지 시작하는 레이드 시즌.
 * 목록이 끝난 뒤는 cadence(주기·기간)로 이어 붙이고 projected: true, status: 'estimated'로 표시한다.
 */
export function listRaidSeasons(
	kind: RaidKind,
	until: string,
	server: ServerId = 'ko'
): RaidSeason[] {
	const schedule = getSchedule(server);
	const listed = schedule.raids.filter((r) => r.kind === kind);
	const out = listed.filter((r) => r.start <= until);
	const last = listed[listed.length - 1];
	if (!last) return out;

	const { intervalDays, durationDays } = schedule.cadence[kind];
	let season = last.season;
	let start = addDays(last.start, intervalDays);
	while (start <= until) {
		season += 1;
		out.push({
			kind,
			season,
			name: '',
			start,
			end: addDays(start, durationDays),
			status: 'estimated',
			projected: true
		});
		start = addDays(start, intervalDays);
	}
	return out;
}

/** 이벤트 일정. 목록 밖은 추정하지 않는다 (schedule.json meta.notes) */
export function listEvents(server: ServerId = 'ko'): ScheduledEvent[] {
	return getSchedule(server).events;
}
