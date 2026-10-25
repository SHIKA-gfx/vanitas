/**
 * 수급 계산기의 입력 (저장 구역 'income').
 * 수급 계산기와 픽업 플래너가 같은 값을 쓴다 — 플래너는 수급 조건을 따로 받지 않는다 (2026-10-24 결정, docs/005).
 * 기본값·검사를 이 파일 하나에 두어 두 화면이 어긋나지 않게 한다.
 */

import { getIncomeSources, listIncomePresets } from '$lib/data';
import { listToggleableSources, presetIncluded } from '$lib/calc/income-adapter';
import type { PlannerIncomeInput } from '$lib/calc/planner-adapter';
import { addDays } from '$lib/game-date';
import { isFutureDate, isInt, isOneOf, isRecordOf, isSubsetOf } from './persist';
import type { ShareField } from './share';

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

/**
 * 공유 링크의 짧은 이름 (기본값과 다른 칸만 실린다). 이미 퍼진 링크가 있어 이름은 바꾸지 않는다.
 * 수급 계산기는 전부, 플래너는 종료 날짜(d)를 뺀 나머지를 쓴다 — 플래너의 기간은 미래시가 정한다
 */
type IncomeKey =
	| 'endDate'
	| 'preset'
	| 'included'
	| 'tacticalDaily'
	| 'raidTier'
	| 'participation'
	| 'subscriptions';

export const INCOME_SHARE_FIELDS: ShareField<IncomeKey>[] = [
	{ key: 'endDate', param: 'd', kind: 'str' },
	{ key: 'preset', param: 'ps', kind: 'str' },
	{ key: 'included', param: 'inc', kind: 'list' },
	{ key: 'tacticalDaily', param: 'tac', kind: 'int' },
	{ key: 'raidTier', param: 'tier', kind: 'str' },
	{ key: 'participation', param: 'ev', kind: 'str' },
	{ key: 'subscriptions', param: 'sub', kind: 'map-str' }
];

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
