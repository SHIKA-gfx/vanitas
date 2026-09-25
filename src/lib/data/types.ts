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
// ---------------------------------------------------------------- 레벨 (shared)

/** apMax 증가 규칙의 한 구간 */
export interface ApMaxIncrement {
	fromLevel: number;
	toLevel: number;
	perLevel: number;
}

export interface LevelRow {
	level: number;
	/** 다음 레벨까지 필요한 경험치 (= 소요 AP). 최고 레벨은 null. */
	expToNext: number | null;
	/** 이 레벨에 도달하기까지의 누적 경험치 (1레벨은 0) */
	expCumulative: number;
	/** 이 레벨의 AP 최대치. 이 레벨에 도달할 때 받는 보너스 AP와 같다. */
	apMax: number;
}

export interface LevelTableFile {
	meta: Meta & { levelCap: number; verifiedBy?: string };
	apMaxRule: { base: number; increments: ApMaxIncrement[] };
	/** 검산 참조용. levels[]에서 재계산 가능하므로 계산에 쓰지 않는다. */
	derived: {
		totalExpToCap: number;
		totalApToCap: number;
		levelUpBonusApTotal: number;
		netApToCap: number;
		_comment?: string;
	};
	levels: LevelRow[];
}

// ---------------------------------------------------------------- 카페 (shared)

export interface CafeRank {
	rank: number;
	maxComfort: number;
	/** 쾌적도 1당 시간당 추가 생산 AP */
	apPerComfort: number;
	maxStorage: number;
}

export interface CafeRanksFile {
	meta: Meta;
	/** 사람이 읽는 공식 설명. 코드는 이 문자열을 해석하지 않는다. */
	formulas: Record<string, string>;
	patterns: Record<string, string>;
	secondCafe: { producesAp: boolean; verifiedAt: string; note?: string };
	ranks: CafeRank[];
}

// ---------------------------------------------------------------- AP

export type ApIncomePeriod = 'daily' | 'weekly' | 'every10days';

export interface ApFixedIncome {
	id: string;
	name: string;
	ap: number;
	period: ApIncomePeriod;
	/** 기간 한정 수급 (예: 2주 패키지) */
	durationDays?: number;
	paid?: boolean;
}

export interface ApPriceTier {
	fromCount: number;
	toCount: number;
	price: number;
}

/** 전술대회 상점의 AP 상품. 진열을 갱신할 때마다 같은 상품을 다시 살 수 있다. */
export interface TacticalShop {
	currency: string;
	resetPeriod: 'daily';
	apItems: { ap: number; price: number }[];
	refresh: { price: number; maxPerDay: number };
	verified: boolean;
	verifiedAt: string;
	note?: string;
}

export interface ApConfig {
	meta: Meta;
	recovery: {
		minutesPerAp: number;
		apPerHour: number;
		apPerDay: number;
		/** 보유 상한. 자연 회복은 이보다 먼저 레벨별 apMax에서 멈춘다. */
		maxHoldingAp: number;
		onLevelUp: {
			exceedsMax: boolean;
			overflowGoesToMail: boolean;
			verified: boolean;
			verifiedAt: string;
			note?: string;
		};
	};
	purchase: {
		currency: string;
		apPerPurchase: number;
		maxPurchasesPerDay: number;
		resetTime: string;
		resetTimezone: string;
		priceTiers: ApPriceTier[];
	};
	tacticalShop: TacticalShop;
	expConversion: { apToExp: number; note?: string };
	fixedIncome: ApFixedIncome[];
}
