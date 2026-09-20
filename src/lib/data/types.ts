// 게임 데이터 JSON의 타입 정의.
// 정본은 data/ 의 JSON이며, 이 파일은 그 구조를 TypeScript에 알려주는 역할만 한다.

/** 모든 데이터 파일이 갖는 공통 메타 블록 */
export interface Meta {
	id: string;
	description: string;
	server?: string;
	verifiedAt: string;
	sources: string[];
	notes?: string[];
}

// ---------------------------------------------------------------- 배너

/** 확률 그룹의 변형. 배너마다 존재하는 variant가 다르다. */
export type RateVariant = 'default' | 'withPickup2Star' | 'tenthPull';

export type Rarity = 1 | 2 | 3;

export interface RateGroup {
	id: string;
	label: string;
	rarity: Rarity;
	/** 그룹 전체 확률(%). 개별 학생 확률은 rate ÷ 풀 크기로 계산한다. */
	rate: number;
	/** pool-sizes.json의 pools 키. 'dynamic'은 시점마다 변하는 풀. */
	poolRef: string;
	verified: boolean;
}

export interface PointPool {
	id: 'recruit' | 'archive' | 'recollect' | 'encore';
	name: string;
	pityThreshold: number;
	exchangeTarget: string;
	/** true면 동시 진행 배너 전체에서 포인트가 합산된다 (recruit만 해당). */
	sharedAcrossBanners: boolean;
	/** true면 기간이 끝나도 포인트가 보존된다 (archive만 해당). */
	carryOver: boolean;
	onExpiry: string | null;
	note?: string;
	availableInKo?: boolean;
}

export interface BannerType {
	id: string;
	nameKo: string;
	nameJa: string;
	availableInKo: boolean;
	introducedAt: string | null;
	operation: string;
	observedDurationDays: number[] | null;
	payment: string[] | null;
	pointPool: PointPool['id'] | null;
	chargeType: string | null;
	has2StarPickup: boolean;
	/** false면 픽뚫로 획득할 수 없다 (특별·앙코르). 플래너 판정에 직결. */
	pickThroughObtainable: boolean;
	rateGroups: Partial<Record<RateVariant, RateGroup[]>>;
	notes?: string[];
	[key: string]: unknown;
}

export interface BannerTypesFile {
	meta: Meta;
	pointPools: PointPool[];
	bannerTypes: BannerType[];
}

// ---------------------------------------------------------------- 풀 크기

export interface PoolEntry {
	size: number;
	groupRate: number;
	perUnitRate: number;
}

export interface PoolSnapshot {
	asOf: string;
	sourceBanner: string;
	sourceUrl: string;
	bannerPeriod: { from: string; to: string } | null;
	pools: Record<string, PoolEntry>;
	tenthPullPools?: Record<string, PoolEntry>;
	note?: string;
}

export interface PoolSizesFile {
	meta: Meta;
	snapshots: PoolSnapshot[];
	pending: { poolRef: string; reason: string }[];
}

// ---------------------------------------------------------------- 게임 설정

/** 천장 시스템. 두 방식은 리셋 조건이 정반대다. */
export type PitySystem = 'point_exchange' | 'charge';

export interface GameConfig {
	meta: Meta;
	pitySystem: {
		current: PitySystem;
		available: PitySystem[];
		effectiveFrom: string | null;
		effectiveTo: string | null;
		note?: string;
	};
	recruitCost: {
		currency: string;
		single: number;
		ten: number;
		tenPullGuarantee: { minRarity: Rarity; slot: number; note?: string };
		ticketRules: { tenSingleTicketsAsTenPull: boolean; mixTicketsWithPyroxene: boolean };
	};
	recruitPoint: {
		perPull: number;
		pityThreshold: number;
		/** false면 픽업을 획득해도 포인트가 유지된다 (한국 현행). */
		resetOnPickupObtained: boolean;
		resetNote?: string;
		lowStockAlertThreshold?: number;
	};
	ratePrecision: {
		decimalPlaces: number;
		roundingAt: number;
		normalizedTo: number;
		note?: string;
	};
	chargeSystem: {
		_status?: string;
		softPity: { count: number; guaranteedRarity: Rarity; pickupChance: number };
		hardPity: { count: number };
		[key: string]: unknown;
	};
	[key: string]: unknown;
}