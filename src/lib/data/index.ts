// 게임 데이터 조회 창구.
// 계산기는 JSON 구조를 직접 알지 않고 이 파일의 함수만 사용한다.
// 2단계에서 DB로 옮길 때 이 파일만 교체하면 된다.

import gameConfigJson from '../../../data/ko/game-config.json';
import bannerTypesJson from '../../../data/ko/banner-types.json';
import poolSizesJson from '../../../data/ko/pool-sizes.json';
import type {
	BannerType,
	BannerTypesFile,
	GameConfig,
	PointPool,
	PoolEntry,
	PoolSizesFile,
	RateGroup,
	RateVariant
} from './types';

const config = gameConfigJson as unknown as GameConfig;
const banners = bannerTypesJson as unknown as BannerTypesFile;
const pools = poolSizesJson as unknown as PoolSizesFile;

export function getGameConfig(): GameConfig {
	return config;
}

export function listBannerTypes(koOnly = true): BannerType[] {
	return banners.bannerTypes.filter((b) => !koOnly || b.availableInKo);
}

export function getBannerType(id: string): BannerType {
	const found = banners.bannerTypes.find((b) => b.id === id);
	if (!found) throw new Error(`알 수 없는 배너 타입: ${id}`);
	return found;
}

export function getPointPool(id: string): PointPool {
	const found = banners.pointPools.find((p) => p.id === id);
	if (!found) throw new Error(`알 수 없는 포인트 풀: ${id}`);
	return found;
}

/** 배너의 확률 그룹. 해당 variant가 없으면 undefined. */
export function getRateGroups(
	bannerId: string,
	variant: RateVariant = 'default'
): RateGroup[] | undefined {
	return getBannerType(bannerId).rateGroups[variant];
}

/**
 * 지정 시점에 유효한 풀 크기.
 * asOf 이하의 스냅샷 중 가장 최신을 쓴다. 없으면 undefined.
 */
export function getPoolEntry(
	poolRef: string,
	options: { asOf?: string; tenthPull?: boolean } = {}
): PoolEntry | undefined {
	const { asOf, tenthPull = false } = options;
	const candidates = pools.snapshots
		.filter((s) => !asOf || s.asOf <= asOf)
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
export function getPerUnitRate(
	group: RateGroup,
	options: { asOf?: string; tenthPull?: boolean } = {}
): number | null {
	if (group.poolRef === 'pickup') return group.rate; // 픽업은 1명이 그룹 전체를 차지
	if (group.poolRef === 'dynamic') return null;
	const entry = getPoolEntry(group.poolRef, options);
	return entry ? group.rate / entry.size : null;
}