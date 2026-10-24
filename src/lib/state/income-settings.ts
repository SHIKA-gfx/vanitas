/**
 * 수급 계산기의 입력 (저장 구역 'income').
 * 수급 계산기와 픽업 플래너가 같은 값을 쓴다 — 플래너는 수급 조건을 따로 받지 않는다 (2026-10-24 결정, docs/005).
 * 기본값·검사를 이 파일 하나에 두어 두 화면이 어긋나지 않게 한다.
 */

import { getIncomeSources, listIncomePresets } from '$lib/data';
import { listToggleableSources, presetIncluded } from '$lib/calc/income-adapter';
import type { PlannerIncomeInput } from '$lib/calc/planner-adapter';
import { addDays } from '$lib/game-date';
import { isFutureDate, isInt, isOneOf, isRecordOf, isSubsetOf, sanitize } from './persist';

export const INCOME_SECTION = 'income';

/** 정액 상품 구매 횟수 선택지의 최대 */
export const SUBSCRIPTION_MAX_COUNT = 6;
export const SUBSCRIPTION_VALUES = [
	'0',
	...Array.from({ length: SUBSCRIPTION_MAX_COUNT }, (_, i) => String(i + 1)),
	'continuous'
];

export interface IncomeSettings extends Record<string, unknown> {
	endDate: string;
	preset: string;
	included: string[];
	tacticalDaily: number;
	raidTier: string;
	participation: string;
	/** 정액 상품 id → '0'~'6' | 'continuous' */
	subscriptions: Record<string, string>;
}

export function incomeDefaults(today: string): IncomeSettings {
	const data = getIncomeSources();
	const presets = listIncomePresets();
	const tactical = data.sources.find((s) => s.id === 'tactical-tournament');
	const raidRank = data.sources.find((s) => s.tiers);
	return {
		endDate: addDays(today, 90),
		preset: presets[0]?.id ?? 'full',
		included: presetIncluded(presets[0]?.id ?? 'full'),
		tacticalDaily: tactical?.amount ?? 0,
		raidTier: raidRank?.tiers?.[0]?.id ?? '',
		participation: data.eventParticipation[0]?.id ?? '',
		subscriptions: Object.fromEntries(data.subscriptions.map((p) => [p.id, '0']))
	};
}

export function incomeChecks(today: string) {
	const data = getIncomeSources();
	const raidRank = data.sources.find((s) => s.tiers);
	return {
		endDate: isFutureDate(today),
		preset: isOneOf(listIncomePresets().map((p) => p.id)),
		included: isSubsetOf(listToggleableSources().map((s) => s.id)),
		tacticalDaily: isInt(0),
		raidTier: isOneOf((raidRank?.tiers ?? []).map((t) => t.id)),
		participation: isOneOf(data.eventParticipation.map((p) => p.id)),
		subscriptions: isRecordOf(
			data.subscriptions.map((p) => p.id),
			(_, v) => isOneOf(SUBSCRIPTION_VALUES)(v)
		)
	};
}

/** 저장된 값(없으면 기본값)을 검사해 돌려준다. 플래너가 수급 계산기의 저장값을 읽을 때 */
export function sanitizeIncome(raw: unknown, today: string): IncomeSettings {
	return sanitize(raw, incomeDefaults(today), incomeChecks(today));
}

/** 수급 계산기 입력 → 계산 인자 (기간·보유 재화를 뺀 부분) */
export function toIncomeInput(s: IncomeSettings, apPurchasesPerDay: number): PlannerIncomeInput {
	return {
		included: s.included,
		tacticalDaily: s.tacticalDaily,
		raidTier: s.raidTier,
		participation: s.participation,
		subscriptions: Object.fromEntries(
			Object.entries(s.subscriptions).map(([id, v]) => [
				id,
				v === 'continuous' ? 'continuous' : Number(v)
			])
		),
		apPurchasesPerDay
	};
}
