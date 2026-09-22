/**
 * 천장·확률 계산기 어댑터.
 *
 * `src/lib/data`의 조회 결과를 `gacha.ts`의 인자로 바꾼다.
 * - gacha.ts는 JSON 구조를 모르고, 이 파일은 계산식을 모른다.
 * - 확률 단위 변환(% → 0~1)은 여기서만 한다.
 * - "그룹 확률 ÷ 풀 크기"는 data 계층의 getPerUnitRate가 정본이다.
 *
 * 현재 범위: ★3 목표. ★2 픽업(10연 블록)은 tenthPull variant에서
 * ★2 픽업 그룹을 찾는 규칙이 정해진 뒤 추가한다.
 */

import {
	getBannerType,
	getGameConfig,
	getPerUnitRate,
	getPointPool,
	type ServerId
} from '$lib/data';
import type { BannerType, RateGroup } from '$lib/data/types';
import { evaluatePickup, type PickupEvaluationInput, type PickupEvaluation } from './gacha';

export interface GachaQuery {
	bannerId: string;
	/** 목표 확률 그룹 id. 생략하면 defaultTargetGroup으로 고른다. */
	targetGroupId?: string;
	gems: number;
	singleTickets?: number;
	tenPullTickets?: number;
	/** 이 배너가 쓰는 포인트 풀(차지 방식이면 차지)에 현재 쌓인 값 */
	currentPoints: number;
	/** 풀 크기 스냅샷 기준일. 생략하면 최신 */
	asOf?: string;
	server?: ServerId;
	curveStep?: number;
}

/**
 * 계산할 수 없는 경우. 화면은 이 값을 메시지 키로 바꿔 보여준다.
 * (컴포넌트에 문자열을 직접 쓰지 않는다 — m.키() 규칙)
 */
export type GachaFailure =
	/** 천장이 없는 배너 (선별 모집 등) */
	| 'no_pity'
	/** 배너에 ★3 확률 그룹이 없거나, 지정한 id가 없다 */
	| 'no_target_group'
	/** 풀 크기를 알 수 없다 (dynamic 풀, 스냅샷 미수집) */
	| 'unknown_pool_size';

export type GachaResult =
	| {
			ok: true;
			banner: BannerType;
			target: RateGroup;
			/** 개별 대상 1회 확률(%) — 화면 표시용 */
			ratePercent: number;
			/** false면 판정 문구를 "놓치면 복각까지 대기"로 분기 */
			pickThroughObtainable: boolean;
			/** false면 "공시 미대조" 표시 */
			verified: boolean;
			evaluation: PickupEvaluation;
	  }
	| { ok: false; reason: GachaFailure; banner: BannerType };

/** 목표로 고를 수 있는 ★3 그룹 목록. 화면의 목표 선택지. */
export function listTargetGroups(banner: BannerType): RateGroup[] {
	return (banner.rateGroups.default ?? []).filter((g) => g.rarity === 3);
}

/** 기본 목표: 픽업 그룹이 있으면 그것, 없으면 첫 ★3 그룹. */
export function defaultTargetGroup(banner: BannerType): RateGroup | undefined {
	const groups = listTargetGroups(banner);
	return groups.find((g) => g.poolRef === 'pickup') ?? groups[0];
}

export function evaluateBanner(query: GachaQuery): GachaResult {
	const server = query.server ?? 'ko';
	const banner = getBannerType(query.bannerId, server);
	const config = getGameConfig(server);
	const fail = (reason: GachaFailure): GachaResult => ({ ok: false, reason, banner });

	// 1. 목표 그룹
	// ★3는 10회차 보정의 영향을 받지 않으므로(validate.py가 매번 검사) default variant만 본다.
	const target = query.targetGroupId
		? listTargetGroups(banner).find((g) => g.id === query.targetGroupId)
		: defaultTargetGroup(banner);
	if (!target) return fail('no_target_group');

	// 2. 개별 확률 (%, data 계층이 계산)
	const ratePercent = getPerUnitRate(target, { asOf: query.asOf, server });
	if (ratePercent === null) return fail('unknown_pool_size');

	// 3. 천장
	let pity: PickupEvaluationInput['pity'];
	if (config.pitySystem.current === 'point_exchange') {
		if (!banner.pointPool) return fail('no_pity');
		const pool = getPointPool(banner.pointPool, server);
		pity = {
			system: 'point_exchange',
			currentPoints: query.currentPoints,
			// 풀별 천장은 PointPool이 정본 (archive 등이 recruit와 다를 수 있음)
			pityThreshold: pool.pityThreshold,
			pointsPerPull: config.recruitPoint.perPull
		};
	} else {
		if (!banner.chargeType) return fail('no_pity');
		pity = {
			system: 'charge',
			currentCharge: query.currentPoints,
			halfThreshold: config.chargeSystem.softPity.count,
			fullThreshold: config.chargeSystem.hardPity.count
		};
	}

	// 4. 계산
	const evaluation = evaluatePickup({
		budget: {
			gems: query.gems,
			singleTickets: query.singleTickets,
			tenPullTickets: query.tenPullTickets,
			costPerPull: config.recruitCost.single,
			costPerTenPull: config.recruitCost.ten
		},
		targetRate: ratePercent / 100,
		pity,
		curveStep: query.curveStep
	});

	return {
		ok: true,
		banner,
		target,
		ratePercent,
		pickThroughObtainable: banner.pickThroughObtainable,
		verified: target.verified,
		evaluation
	};
}

/**
 * 배너를 지금 계산할 수 있는지 미리 확인한다. 계산할 수 없으면 그 이유를 돌려준다.
 * 배너 선택지에 "준비 중" 표시를 붙이는 데 쓴다.
 * 판정 기준을 evaluateBanner와 하나로 유지하려고 같은 함수를 빈 입력으로 호출한다.
 */
export function bannerAvailability(
	bannerId: string,
	options: { asOf?: string; server?: ServerId } = {}
): GachaFailure | null {
	const r = evaluateBanner({ bannerId, gems: 0, currentPoints: 0, ...options });
	return r.ok ? null : r.reason;
}

