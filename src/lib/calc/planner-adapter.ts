/**
 * 픽업 플래너 어댑터 (docs/005).
 *
 * `src/lib/data`의 미래시·학생·스택 규칙과 수급 계산 결과를 `planner.ts`의 인자로 바꾼다.
 * - planner.ts는 날짜 문자열·JSON을 모르고, 이 파일은 배정 규칙을 모른다
 * - 수급은 수급 계산기 입력을 그대로 받아 calculateIncome으로 계산한다 (2026-10-24 결정)
 * - 날짜는 오늘을 0으로 하는 일 수로 바꾼다
 */

import {
	getBannerType,
	getGameConfig,
	getPityRule,
	getSchedule,
	getStudent,
	listRecruits,
	type ServerId
} from '$lib/data';
import type { ChargeType, RecruitPeriod, Student } from '$lib/data/types';
import { daysBetween } from '$lib/game-date';
import { defaultTargetGroup } from './gacha-adapter';
import {
	calculateIncome,
	type IncomeField,
	type IncomeInput,
	type IncomeOutcome
} from './income-adapter';
import { planPickups, type PlanOptions, type PlannerResult, type PlannerTarget } from './planner';

/** 마일리지 보상인 "10회 모집 티켓" 1장의 연차 (gacha-adapter와 같은 값) */
export const TEN_PULL_TICKET_PULLS = 10;

/** 수급 계산기 입력 중 플래너가 그대로 넘겨받는 부분 */
export type PlannerIncomeInput = Omit<
	IncomeInput,
	'today' | 'endDate' | 'gems' | 'singleTickets' | 'tenPullTickets' | 'server'
>;

export interface PlannerQuery {
	/** 오늘 게임 날짜 */
	today: string;
	/** 목표 — 배열 순서가 우선순위 */
	targets: { recruitId: string; studentId: string }[];
	gems: number;
	singleTickets: number;
	tenPullTickets: number;
	/** 종류별 지금 스택 (UserState.resources.stackByType) */
	stacks: Record<string, number>;
	/** 지금 진행 중인 기간의 모집 마일리지 */
	mileage: number;
	reserveGems?: number;
	income: PlannerIncomeInput;
	server?: ServerId;
}

/** 화면이 고를 수 있는 목표 한 명 */
export interface PlannerChoice {
	recruitId: string;
	studentId: string;
	student: Student;
	bannerType: string;
	stack: ChargeType;
}

export interface PlannerChoicePeriod {
	recruit: RecruitPeriod;
	choices: PlannerChoice[];
	/** 픽업 외 모집 가능 학생 — 스택으로 확정되지 않아 고를 수 없다 (보여주기만) */
	offPickup: Student[];
}

export type PlannerOutcome =
	| { kind: 'invalid_income'; field: IncomeField }
	| { kind: 'no_recruits' }
	| {
			kind: 'ok';
			result: PlannerResult;
			/** 계획에 쓴 픽업 기간 (오늘 이후에 끝나는 것) */
			recruits: RecruitPeriod[];
			/** 추정 일정이 섞여 있다 */
			scheduleEstimated: boolean;
			/** 미래시를 마지막으로 확인한 날 */
			scheduleVerifiedAt: string;
			/** 수급에 추정 수치가 섞여 있다 */
			incomeEstimated: boolean;
			/** 하루 평균 순수입 (수급 조건 요약 한 줄) */
			incomePerDay: number;
			/** 마일리지 초회 보상이 기간마다 다시 주어진다는 미확인 가정에 기댄다 */
			mileageAssumed: boolean;
			/** 무료 모집이 있지만 계산에 넣지 않은 기간 (스택·마일리지 적립 미확인) */
			freePullsIgnored: string[];
	  };

/**
 * 고를 수 있는 목표. 오늘 이후에 끝나는 기간의 픽업 학생을 기간 순으로.
 * 스택 방식이 아닌 배너(규칙 미확인)는 고를 수 없다.
 */
export function listPlannerChoices(today: string, server: ServerId = 'ko'): PlannerChoicePeriod[] {
	return listRecruits({ from: today, server }).map((recruit) => ({
		recruit,
		offPickup: (recruit.offPickup ?? []).map((id) => getStudent(id, server)),
		choices: recruit.banners.flatMap((b) => {
			const rule = getPityRule(b.type, recruit.start, server);
			if (rule.kind !== 'charge') return [];
			return b.students.map((studentId) => ({
				recruitId: recruit.id,
				studentId,
				student: getStudent(studentId, server),
				bannerType: b.type,
				stack: rule.chargeType
			}));
		})
	}));
}

/**
 * 플래너가 쓰는 수급 — 오늘부터 마지막 픽업 기간이 끝나는 날까지. 계획할 픽업이 없으면 null.
 * 부족분 메우기(planner-fill.ts)가 수급 조건만 바꿔 여러 번 부르므로 따로 둔다
 */
export function plannerIncome(query: PlannerQuery): IncomeOutcome | null {
	const server = query.server ?? 'ko';
	const recruits = listRecruits({ from: query.today, server });
	if (recruits.length === 0) return null;
	return calculateIncome({
		...query.income,
		today: query.today,
		endDate: recruits[recruits.length - 1].end,
		gems: query.gems,
		singleTickets: query.singleTickets,
		tenPullTickets: query.tenPullTickets,
		server
	});
}

export interface PlanFromDataOptions extends PlanOptions {
	/** 같은 query로 이미 계산한 수급 (plannerIncome). 다시 돌릴 때 수급 계산을 아낀다 */
	income?: IncomeOutcome;
}

export function planFromData(
	query: PlannerQuery,
	options: PlanFromDataOptions = {}
): PlannerOutcome {
	const server = query.server ?? 'ko';
	const recruits = listRecruits({ from: query.today, server });
	if (recruits.length === 0) return { kind: 'no_recruits' };
	const config = getGameConfig(server);
	const cs = config.chargeSystem;

	// 1. 수급 — 마지막 기간이 끝나는 날까지
	const income = options.income ?? plannerIncome(query);
	if (!income) return { kind: 'no_recruits' };
	if (income.kind === 'invalid') return { kind: 'invalid_income', field: income.field };

	const ownedTicketPulls = query.singleTickets + query.tenPullTickets * TEN_PULL_TICKET_PULLS;
	let receivedTickets = 0;
	const ticketPullsByDay = income.records.map((r) => {
		receivedTickets += r.tickets;
		return ownedTicketPulls + receivedTickets * TEN_PULL_TICKET_PULLS;
	});

	// 2. 목표 — 기간·배너를 찾아 스택 종류와 1회 확률을 붙인다
	const choices = listPlannerChoices(query.today, server).flatMap((p) => p.choices);
	const targets: PlannerTarget[] = query.targets.map(({ recruitId, studentId }) => {
		const choice = choices.find((c) => c.recruitId === recruitId && c.studentId === studentId);
		// 고를 수 없는 목표(끝난 기간 등)는 없는 기간으로 넘겨 planner가 unavailable로 돌려주게 한다
		if (!choice) return { id: studentId, periodId: recruitId, stackType: '', rate: null };
		const group = defaultTargetGroup(getBannerType(choice.bannerType, server));
		return {
			id: studentId,
			periodId: recruitId,
			stackType: choice.stack.id,
			rate: group?.poolRef === 'pickup' ? group.rate / 100 : null
		};
	});

	const result = planPickups(
		{
			// 끝난 기간도 넘긴다 — 저장·공유된 목표가 끝난 기간을 가리키면 planner가 period_ended로 알려준다
			periods: listRecruits({ server }).map((r) => ({
				id: r.id,
				startDay: daysBetween(query.today, r.start),
				endDay: daysBetween(query.today, r.end)
			})),
			targets,
			gemsByDay: income.records.map((r) => r.balance),
			ticketPullsByDay,
			stacks: query.stacks,
			currentMileage: query.mileage,
			rule: {
				half: cs.softPity.count,
				halfPickupChance: cs.softPity.pickupChance,
				full: cs.hardPity.count,
				perPull: cs.perPull
			},
			mileage: { ticketAt: cs.mileage.tenPullTicketAt, pullsPerTicket: TEN_PULL_TICKET_PULLS },
			costPerPull: config.recruitCost.single,
			reserveGems: query.reserveGems
		},
		{ alternatives: options.alternatives }
	);

	return {
		kind: 'ok',
		result,
		recruits,
		scheduleEstimated: recruits.some((r) => r.status === 'estimated'),
		scheduleVerifiedAt:
			getSchedule(server).meta.recruitsVerifiedAt ?? getSchedule(server).meta.verifiedAt,
		incomeEstimated: income.estimated,
		incomePerDay: income.perDay,
		mileageAssumed: cs.mileage.firstTimeScope === 'unconfirmed' && result.periods.length > 0,
		freePullsIgnored: recruits.filter((r) => r.freePulls).map((r) => r.id)
	};
}
