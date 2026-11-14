/**
 * 데이터 문서 편집의 차림 (docs/006 6-3-3, ④-4).
 *
 * 문서(파일) 단위가 아니라 **계산기별 묶음**으로 보여 준다. 한 묶음은 문서 하나의 맨 위 칸 몇 개다.
 * 문서 10개의 맨 위 칸은 모두 어느 묶음엔가 꼭 한 번 들어간다 (doc-sections.test.ts가 지킨다) —
 * 데이터 파일에 새 칸이 생기면 여기에 넣어야 테스트가 통과한다.
 * 정식 표로 뺀 배열(미래시·학생·출처)은 각 탭에서 고친다.
 *
 * 어느 계산기가 무엇을 쓰는지는 src/lib/calc/*-adapter.ts의 조회 함수 기준 (2026-11-14).
 */
import type { NavIconName } from '$lib/icons/NavIcon.svelte';

export type DocPath =
	| 'ko/schedule.json'
	| 'ko/income-sources.json'
	| 'ko/ap-config.json'
	| 'ko/game-config.json'
	| 'ko/banner-types.json'
	| 'ko/pool-sizes.json'
	| 'ko/students.json'
	| 'shared/level-table.json'
	| 'shared/cafe-ranks.json'
	| 'sources.json';

export interface DocSection {
	id: string;
	title: string;
	/** 무엇이고 어디에 쓰이나 (한 줄) */
	description: string;
	path: DocPath;
	/** 이 묶음이 보여 주는 문서의 맨 위 칸 (문서 순서대로) */
	keys: string[];
}

export interface DocGroup {
	id: string;
	title: string;
	icon: NavIconName | null;
	sections: DocSection[];
}

export const DOC_GROUPS: DocGroup[] = [
	{
		id: 'income',
		title: '청휘석 수급 계산기',
		icon: 'gem',
		sections: [
			{
				id: 'raids',
				title: '레이드 일정',
				description: '총력전·대결전 시즌과 주기. 시즌 보상이 들어오는 날을 정한다',
				path: 'ko/schedule.json',
				keys: ['cadence', 'raids']
			},
			{
				id: 'events',
				title: '이벤트 일정',
				description: '이벤트 기간 (신규·복각). 이벤트 보상이 들어오는 날을 정한다',
				path: 'ko/schedule.json',
				keys: ['events']
			},
			{
				id: 'income-sources',
				title: '수급원',
				description: '매일·매주·시즌마다 들어오는 청휘석과 모집권 — 수급 계산기의 항목',
				path: 'ko/income-sources.json',
				keys: ['sources']
			},
			{
				id: 'subscriptions',
				title: '정액 상품·이벤트 참여',
				description: '월정액 같은 정액 상품, 이벤트 참여 정도별 수급 (부족분 메우기도 쓴다)',
				path: 'ko/income-sources.json',
				keys: ['subscriptions', 'eventParticipation']
			},
			{
				id: 'presets',
				title: '기본값 묶음',
				description: '수급 계산기의 "전부·주요·로그인만" 같은 기본 선택',
				path: 'ko/income-sources.json',
				keys: ['presets']
			}
		]
	},
	{
		id: 'levelup',
		title: '레벨업 계산기',
		icon: 'level',
		sections: [
			{
				id: 'levels',
				title: '레벨 표',
				description: '레벨별 필요 경험치와 AP 최대치',
				path: 'shared/level-table.json',
				keys: ['apMaxRule', 'derived', 'levels']
			},
			{
				id: 'ap',
				title: 'AP 회복·구매',
				description:
					'자연 회복, 청휘석 구매 단가, 전술대회 상점, 경험치 교환, 최고 레벨 보상, 고정 AP',
				path: 'ko/ap-config.json',
				keys: [
					'recovery',
					'purchase',
					'tacticalShop',
					'expConversion',
					'levelCapReward',
					'fixedIncome'
				]
			},
			{
				id: 'cafe',
				title: '카페 랭크',
				description: '카페 랭크별 쾌적도·AP 생산, 2호점',
				path: 'shared/cafe-ranks.json',
				keys: ['formulas', 'patterns', 'secondCafe', 'ranks']
			}
		]
	},
	{
		id: 'recruit',
		title: '천장·확률 계산기 · 픽업 플래너',
		icon: 'pity',
		sections: [
			{
				id: 'recruit-system',
				title: '모집 방식 (천장·스택)',
				description: '날짜별 천장 방식과 모집 스택 규칙 — 무료 모집·마일리지 포함',
				path: 'ko/game-config.json',
				keys: ['pitySystem', 'chargeSystem']
			},
			{
				id: 'recruit-cost',
				title: '모집 비용·포인트·확률 표기',
				description: '1회·10회 비용, 모집 포인트, 확률 소수 자리',
				path: 'ko/game-config.json',
				keys: ['recruitCost', 'recruitPoint', 'ratePrecision']
			},
			{
				id: 'recruit-rewards',
				title: '보상 (첫 클리어·중복·엘리그마)',
				description: '첫 클리어 보너스, 중복 학생 보상, 엘리그마 조각',
				path: 'ko/game-config.json',
				keys: ['firstClearBonus', 'duplicateRewards', 'eligmaFragment']
			},
			{
				id: 'banner-types',
				title: '배너 종류·확률',
				description: '배너마다 확률 묶음·스택 종류·픽뚫 여부, 모집 포인트 묶음',
				path: 'ko/banner-types.json',
				keys: ['pointPools', 'bannerTypes']
			},
			{
				id: 'pool-sizes',
				title: '학생 풀 크기',
				description: '확률을 나눌 학생 수 (시점별 기록)',
				path: 'ko/pool-sizes.json',
				keys: ['snapshots', 'pending']
			},
			{
				id: 'game-config-log',
				title: '규칙 바뀐 기록',
				description: '모집 규칙이 바뀐 날과 내용 (공지 기준)',
				path: 'ko/game-config.json',
				keys: ['changeLog']
			}
		]
	},
	{
		id: 'meta',
		title: '문서 정보',
		icon: null,
		sections: [
			meta(
				'ko/schedule.json',
				'일정 (schedule.json)',
				'설명·확인일·출처 — 미래시 "일정 확인일"(recruitsVerifiedAt)도 여기'
			),
			meta('ko/students.json', '학생 (students.json)', '설명·출처'),
			{
				...meta(
					'sources.json',
					'출처 (sources.json)',
					'설명, 주소 미확보·안 쓰는 출처 목록 (메모용)'
				),
				keys: ['meta', 'missingUrls', 'unusedIds']
			},
			meta('ko/income-sources.json', '수급원 (income-sources.json)', '설명·확인일·출처'),
			meta('ko/ap-config.json', 'AP (ap-config.json)', '설명·확인일·출처'),
			meta('shared/level-table.json', '레벨 표 (level-table.json)', '설명·확인일·출처'),
			meta('shared/cafe-ranks.json', '카페 랭크 (cafe-ranks.json)', '설명·확인일·출처'),
			meta('ko/game-config.json', '모집 규칙 (game-config.json)', '설명·확인일·출처'),
			meta('ko/banner-types.json', '배너 종류 (banner-types.json)', '설명·확인일·출처'),
			meta('ko/pool-sizes.json', '풀 크기 (pool-sizes.json)', '설명·확인일·출처')
		]
	}
];

function meta(path: DocPath, title: string, description: string): DocSection {
	return { id: `meta:${path}`, title, description, path, keys: ['meta'] };
}

export const ALL_SECTIONS: DocSection[] = DOC_GROUPS.flatMap((g) => g.sections);

/** 정식 표로 뺀 칸 — 여기서는 고치지 않는다 (자리 표시) */
export const TABLED: Readonly<Record<string, string>> = {
	'ko/schedule.json:recruits': '미래시',
	'ko/students.json:students': '학생',
	'sources.json:sources': '출처'
};

// ------------------------------------------------------------ 칸 이름 (자주 나오는 것만 — 없으면 키 그대로)

/** 문서의 맨 위 칸 중 KEY_LABELS의 이름이 맞지 않는 것 ("문서 경로:키") — 수급원 문서의 sources는 출처가 아니다 */
export const TOP_LABELS: Readonly<Record<string, string>> = {
	'ko/income-sources.json:sources': '수급원'
};

export const KEY_LABELS: Readonly<Record<string, string>> = {
	id: 'id',
	name: '이름',
	label: '표시 이름',
	nameKo: '한국어 이름',
	nameJa: '일본어 이름',
	kind: '종류',
	season: '시즌',
	start: '시작',
	end: '끝',
	status: '상태',
	note: '메모',
	notes: '메모',
	_note: '메모',
	_comment: '메모',
	description: '설명',
	sources: '출처',
	verified: '확인됨',
	verifiedAt: '확인한 날',
	recruitsVerifiedAt: '미래시 일정 확인일',
	server: '서버',
	amount: '수량',
	period: '주기',
	schedule: '일정',
	unit: '단위',
	paid: '유료',
	price: '가격',
	category: '분류',
	level: '레벨',
	expToNext: '다음 레벨까지 경험치',
	expCumulative: '누적 경험치',
	apMax: 'AP 최대치',
	rarity: '★',
	rate: '확률',
	groupRate: '묶음 확률',
	perUnitRate: '1명당 확률',
	poolRef: '풀',
	size: '학생 수',
	durationDays: '기간 (일)',
	intervalDays: '주기 (일)',
	effectiveFrom: '적용 시작',
	system: '방식',
	rank: '랭크',
	maxComfort: '최대 쾌적도',
	apPerComfort: '쾌적도당 AP',
	maxStorage: '최대 보관',
	fromCount: '구매 횟수 (부터)',
	toCount: '구매 횟수 (까지)',
	availableInKo: '한국 서버 운영',
	introducedAt: '처음 나온 날',
	observedDurationDays: '관찰된 기간 (일)',
	chargeType: '스택 종류',
	pointPool: '포인트 묶음',
	has2StarPickup: '★2 픽업 있음',
	pickThroughObtainable: '픽뚫로 얻을 수 있음',
	rateGroups: '확률 묶음',
	pityThreshold: '천장 (회)',
	tiers: '등급',
	tierNote: '등급 안내',
	rankRewards: '순위별 보상',
	date: '날짜',
	change: '바뀐 내용',
	asOf: '기준일',
	accumulate: '쌓임',
	freePulls: '무료 모집',
	mileage: '마일리지',
	from: '부터',
	to: '까지',
	min: '최소',
	max: '최대',
	count: '횟수',
	reason: '이유',
	// 문서 정보·출처
	meta: '문서 정보',
	trustOrder: '믿는 순서',
	missingUrls: '주소 미확보',
	unusedIds: '안 쓰는 출처',
	source: '출처',
	// 일정 (schedule.json)
	cadence: '주기',
	totalAssault: '총력전',
	grandAssault: '대결전',
	raids: '레이드',
	events: '이벤트',
	// 수급 (income-sources.json)
	subscriptions: '정액 상품',
	eventParticipation: '이벤트 참여 정도',
	presets: '기본값 묶음',
	include: '넣는 수급원',
	factor: '배율',
	instant: '바로 받음',
	daily: '매일',
	currency: '재화',
	amountRange: '수량 범위',
	amountNote: '수량 안내',
	varianceNote: '변동 안내',
	rankRewardsNote: '순위 보상 안내',
	samples: '실측 기록',
	// AP (ap-config.json)
	recovery: '자연 회복',
	minutesPerAp: 'AP 1당 (분)',
	apPerHour: '시간당 AP',
	apPerDay: '하루 AP',
	maxHoldingAp: '보유 상한',
	onLevelUp: '레벨업할 때',
	exceedsMax: '상한 넘김',
	overflowGoesToMail: '넘친 만큼 우편함',
	purchase: '청휘석 구매',
	apPerPurchase: '1회 구매 AP',
	maxPurchasesPerDay: '하루 최대 구매',
	resetTime: '초기화 시각',
	resetTimezone: '시간대',
	priceTiers: '가격 단계',
	tacticalShop: '전술대회 상점',
	resetPeriod: '초기화 주기',
	apItems: 'AP 상품',
	ap: 'AP',
	refresh: '갱신',
	maxPerDay: '하루 최대',
	expConversion: '경험치 교환',
	apToExp: 'AP 1당 경험치',
	levelCapReward: '최고 레벨 보상',
	item: '아이템',
	perAp: 'AP 1당',
	fixedIncome: '고정 AP',
	// 모집 규칙 (game-config.json)
	pitySystem: '천장 방식',
	available: '있는 방식',
	chargeSystem: '스택 방식',
	recruitCost: '모집 비용',
	single: '1회',
	ten: '10회',
	tenPullGuarantee: '10회 확정',
	minRarity: '최소 ★',
	slot: '자리',
	ticketRules: '티켓 규칙',
	recruitPoint: '모집 포인트',
	perPull: '1회당',
	resetOnPickupObtained: '픽업 얻으면 초기화',
	resetNote: '초기화 안내',
	lowStockAlertThreshold: '부족 알림 기준',
	ratePrecision: '확률 표기',
	decimalPlaces: '소수 자리',
	roundingAt: '반올림 자리',
	normalizedTo: '합계 보정',
	firstClearBonus: '초회 보너스',
	eleph: '엘레프',
	scope: '범위',
	rerunEligible: '복각도 받음',
	exception: '예외',
	recollectException: '리콜렉트 예외',
	duplicateRewards: '중복 보상',
	isPickup: '픽업',
	eligma: '엘리그마',
	fragmentsPerStone: '기동석 1개당 조각',
	softPity: '중간 보장',
	hardPity: '천장',
	guaranteedRarity: '확정 ★',
	pickupChance: '픽업일 확률',
	chargeTypes: '스택 종류',
	appliesTo: '쓰는 배너',
	unconfirmedBanners: '미확인 배너',
	unconfirmedNote: '미확인 안내',
	sharedBetweenTypes: '종류끼리 공유',
	carryOver: '이월',
	carryOverNote: '이월 안내',
	ticketsAccumulate: '티켓도 쌓임',
	ticketsNote: '티켓 안내',
	pointsAtSwitch: '바뀔 때 남은 포인트',
	value: '값',
	assumed: '가정',
	sharedAcross: '같이 쓰는 배너',
	tenPullTicketAt: '10회 티켓 받는 마일리지',
	ticketKind: '티켓 종류',
	firstTimeLast: '초회 마지막',
	repeatAfterFirstTime: '초회 뒤 반복',
	repeatRewardsIncludeTickets: '반복 보상에 티켓',
	firstTimeScope: '초회 범위',
	changeLog: '바뀐 기록',
	// 배너 (banner-types.json)
	pointPools: '포인트 묶음',
	exchangeTarget: '교환 대상',
	sharedAcrossBanners: '배너끼리 공유',
	onExpiry: '끝날 때',
	underCharge: '스택 방식에서',
	bannerTypes: '배너 종류',
	operation: '운영 방식',
	payment: '결제 수단',
	default: '기본',
	withPickup2Star: '★2 픽업이 있을 때',
	tenthPull: '10번째 자리',
	obtainability: '얻는 길',
	outsideBannerPeriod: '기간 밖에서',
	viaPickThrough: '픽뚫로',
	hiddenFromRoster: '명단에 안 보임',
	paidExceptionNote: '유료 예외 안내',
	roster: '명단',
	composition: '구성',
	userSelectsPickup: '픽업 직접 고름',
	sizeAsOf: '인원 (기준일)',
	mutuallyExclusiveWithNormalPool: '통상 풀과 겹치지 않음',
	// 풀 크기 (pool-sizes.json)
	snapshots: '기록',
	sourceBanner: '근거 배너',
	sourceUrl: '근거 주소',
	bannerPeriod: '배너 기간',
	pools: '풀',
	tenthPullPools: '10번째 자리 풀',
	pending: '확인 대기',
	// 레벨 (level-table.json)
	levelCap: '최고 레벨',
	verifiedBy: '확인 방법',
	apMaxRule: 'AP 최대치 규칙',
	base: '시작값',
	increments: '늘어나는 양',
	fromLevel: '레벨 (부터)',
	toLevel: '레벨 (까지)',
	perLevel: '레벨당',
	derived: '계산값 (검산용)',
	totalExpToCap: '최고 레벨까지 경험치',
	totalApToCap: '최고 레벨까지 AP',
	levelUpBonusApTotal: '레벨업 보너스 AP 합',
	netApToCap: '보너스 뺀 AP',
	levels: '레벨',
	// 카페 (cafe-ranks.json)
	formulas: '계산식',
	baseProductionPerHour: '시간당 기본 생산',
	maxProductionPerHour: '시간당 최대 생산',
	accumulatedAp: '쌓이는 AP',
	fullChargeHours: '가득 차는 시간',
	patterns: '규칙 (메모)',
	baseProduction: '기본 생산',
	maxProduction: '최대 생산',
	secondCafe: '2호점',
	producesAp: 'AP 생산',
	ranks: '랭크'
};

/** 고를 수 있는 값이 정해진 칸 (validate.py의 허용 목록과 같다). 표 안에서는 괄호 앞 이름만 보인다 (enumShort) */
export const ENUMS: Readonly<Record<string, readonly { value: string; label: string }[]>> = {
	status: [
		{ value: 'announced', label: '공지 (announced)' },
		{ value: 'estimated', label: '추정 (estimated)' }
	],
	period: [
		{ value: 'daily', label: '매일 (daily)' },
		{ value: 'weekly', label: '매주 (weekly)' },
		{ value: 'every10days', label: '10일마다 (every10days)' },
		{ value: 'perSeason', label: '시즌마다 (perSeason)' },
		{ value: 'perSeasonDay', label: '시즌 날마다 (perSeasonDay)' },
		{ value: 'perEvent', label: '이벤트마다 (perEvent)' },
		{ value: 'irregular', label: '부정기 (irregular)' }
	],
	unit: [
		{ value: 'pyroxene', label: '청휘석 (pyroxene)' },
		{ value: 'tenPullTicket', label: '10회 모집권 (tenPullTicket)' }
	]
};

/** 표 안의 고르기 칸에 보일 짧은 이름: "공지 (announced)" → "공지" */
export function enumShort(label: string): string {
	return label.replace(/ \(.*\)$/, '');
}

/** 목록 칸(배열)에서 한 줄을 부를 이름 — 카드 제목 */
export function itemTitle(item: unknown, index: number): string {
	if (item && typeof item === 'object' && !Array.isArray(item)) {
		const o = item as Record<string, unknown>;
		for (const k of ['label', 'name', 'nameKo', 'id', 'kind', 'date', 'system']) {
			if (typeof o[k] === 'string' && o[k]) return `${o[k]}`;
		}
	}
	return `#${index + 1}`;
}
