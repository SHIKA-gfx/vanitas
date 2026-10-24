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
	/**
	 * 스택 방식(charge) 이후 이 풀이 어떻게 되는가.
	 * replaced: 스택으로 대체 / kept: 그대로 유지(아카이브) / unconfirmed: 미확인 → 계산기 "준비 중"
	 */
	underCharge: 'replaced' | 'kept' | 'unconfirmed';
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
	/** 스택 방식에서 쓰는 스택 (ChargeType id). 한국에서 확인되지 않은 배너는 null. */
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

/**
 * 천장 시스템. 두 방식은 리셋 조건이 정반대다.
 * charge는 일본의 '모집 차지', 한국의 '모집 스택'을 함께 부르는 내부 이름이다.
 */
export type PitySystem = 'point_exchange' | 'charge';

/** 한 천장 시스템이 적용되기 시작한 날. 게임 날짜 기준 */
export interface PitySystemPeriod {
	system: PitySystem;
	/** 'YYYY-MM-DD' 게임 날짜 */
	effectiveFrom: string;
	status: 'announced' | 'estimated';
	sources?: string[];
}

/** 스택 종류 (한국: 모집 스택 / 특별 스택). 종류끼리 공유되지 않는다. */
export interface ChargeType {
	id: string;
	name: string;
	/** 이 스택이 쌓이는 배너 타입 id */
	appliesTo: string[];
	verified: boolean;
}

/** 모집 마일리지. 같은 기간의 모집끼리 공유하고 기간이 끝나면 사라진다. */
export interface RecruitMileage {
	name: string;
	perPull: number;
	sharedAcross: string[];
	carryOver: boolean;
	/** 10회 모집 티켓(기간제)을 1장 받는 누적 마일리지 (초회 보상) */
	tenPullTicketAt: number[];
	ticketKind: string;
	/** 초회 보상의 마지막 단계 */
	firstTimeLast: number;
	repeatAfterFirstTime: boolean;
	repeatRewardsIncludeTickets: boolean;
	/** 초회 보상이 기간마다 다시 시작되는지 (공지 미확인) */
	firstTimeScope: 'period' | 'account' | 'unconfirmed';
	firstTimeScopeAssumed?: 'period' | 'account';
	note?: string;
	verified: boolean;
}

export interface GameConfig {
	meta: Meta;
	pitySystem: {
		available: PitySystem[];
		/** effectiveFrom 오름차순. 날짜별 적용은 getPitySystem으로 조회 */
		schedule: PitySystemPeriod[];
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
		sources?: string[];
		perPull: number;
		softPity: { count: number; guaranteedRarity: Rarity; pickupChance: number; verified: boolean };
		hardPity: { count: number; verified: boolean };
		chargeTypes: ChargeType[];
		/** 개편 후 규칙이 공지되지 않은 배너 타입 id */
		unconfirmedBanners: string[];
		sharedBetweenTypes: boolean;
		carryOver: boolean;
		resetOnPickupObtained: boolean;
		mileage: RecruitMileage;
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
	/** 최고 레벨에서 AP를 쓰면 받는 보상 (경험치 대신) */
	levelCapReward: {
		item: string;
		perAp: number;
		verified: boolean;
		verifiedAt: string;
		source?: string;
		note?: string;
	};
	fixedIncome: ApFixedIncome[];
}

// ---------------------------------------------------------------- 청휘석 수급 (server)

/** 수급 주기. perSeason / perSeasonDay / perEvent는 schedule이 가리키는 일정표를 따른다 */
export type IncomePeriod =
	'daily' | 'weekly' | 'every10days' | 'perSeason' | 'perSeasonDay' | 'perEvent' | 'irregular';

/** 수급원이 따르는 일정 */
export type ScheduleStream = 'totalAssault' | 'grandAssault' | 'event';

export interface IncomeTier {
	id: string;
	label: string;
	amount: number;
}

export interface IncomeSource {
	id: string;
	name: string;
	category: string;
	/** 계산기 기본값. unit이 tenPullTicket이면 티켓 장수 */
	amount: number | null;
	unit?: 'pyroxene' | 'tenPullTicket';
	period: IncomePeriod;
	schedule?: ScheduleStream;
	amountRange?: { min: number; max: number };
	tiers?: IncomeTier[];
	tierNote?: string;
	samples?: { date: string; amount: number }[];
	verified: boolean;
	note?: string;
	[key: string]: unknown;
}

/** 월정액·반정액 */
export interface Subscription {
	id: string;
	name: string;
	/** 구매 즉시 받는 청휘석 */
	instant: number;
	/** 기간 동안 매일 받는 청휘석 */
	daily: number;
	durationDays: number;
	paid: boolean;
	verified: boolean;
}

export interface EventParticipation {
	id: string;
	label: string;
	/** 이벤트 수급량에 곱하는 값 (0~1) */
	factor: number;
}

export interface IncomePreset {
	label: string;
	/** 포함할 무료 수급원 id */
	include: string[];
}

export interface IncomeSourcesFile {
	meta: Meta & { currency: string };
	sources: IncomeSource[];
	subscriptions: Subscription[];
	eventParticipation: EventParticipation[];
	presets: Record<string, IncomePreset | string>;
}

// ---------------------------------------------------------------- 일정표 (server)

export type ScheduleStatus = 'announced' | 'estimated';
export type RaidKind = 'totalAssault' | 'grandAssault';

export interface RaidSeason {
	kind: RaidKind;
	season: number;
	name: string;
	/** 게임 날짜 YYYY-MM-DD. 시즌 길이 = end - start */
	start: string;
	end: string;
	status: ScheduleStatus;
	/** true면 목록 밖을 cadence로 이어 붙인 시즌 (조회 함수가 만든다. JSON에는 없다) */
	projected?: boolean;
}

export interface ScheduledEvent {
	name: string;
	kind: 'new' | 'rerun';
	start: string;
	end: string;
	status: ScheduleStatus;
}

export interface ScheduleFile {
	/** recruitsVerifiedAt: 픽업 미래시(recruits)를 마지막으로 확인한 날. 레이드·이벤트와 따로 갱신한다 */
	meta: Meta & { recruitsVerifiedAt?: string };
	cadence: Record<RaidKind, { intervalDays: number; durationDays: number }>;
	raids: RaidSeason[];
	events: ScheduledEvent[];
	/** 모집 스택 시대(2026-11-10~)의 픽업 기간. 픽업 플래너가 쓴다 (docs/005) */
	recruits: RecruitPeriod[];
}

/** 한 픽업 기간. 같은 기간에 배너가 여럿 열린다 */
export interface RecruitPeriod {
	/** 'YYYY-MM-DD-슬러그' — 공유 링크·저장값이 가리키는 이름이라 바꾸지 않는다 */
	id: string;
	start: string;
	end: string;
	status: 'announced' | 'estimated';
	/** 함께 열리는 이벤트 이름 (표시용) */
	event?: string;
	/** 무료 모집 횟수 (스택·마일리지에 쌓이는지는 미확인) */
	freePulls?: number;
	banners: RecruitBanner[];
	sources: string[];
	note?: string;
}

export interface RecruitBanner {
	/** banner-types.json id. 스택 종류·픽뚫 여부는 여기서 파생한다 (저장하지 않는다) */
	type: string;
	/** students.json id */
	students: string[];
}

/** 플래너가 고를 수 있는 학생. 미래시에 나오는 학생만 */
export interface Student {
	id: string;
	/** 게임 내부 학생 번호 */
	gameId: number;
	name: { ko: string; ja: string | null };
	/** provisional: 한국 미출시라 공식 표기가 없어 커뮤니티 이름을 쓴 것 → 화면에 '가칭' */
	koNameStatus: 'official' | 'provisional';
}

export interface StudentsFile {
	meta: Meta;
	students: Student[];
}
