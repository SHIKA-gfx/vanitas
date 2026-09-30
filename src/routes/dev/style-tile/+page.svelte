<!--
	/ko/dev/style-tile — 스타일 타일 (개발 중에만).
	토큰·글꼴·패널 변형·입력칸 상태·그래프·아이콘·의미 색 후보를 한 화면에 모아 눈으로 확인한다.
	여기서 정한 값을 4단계에서 layout.css 토큰으로, 5단계에서 부품으로 옮긴다.
	개발용 페이지라 문구를 메시지 파일에 넣지 않고 직접 쓴다.
-->
<script lang="ts">
	import Panel from '$lib/components/Panel.svelte';
	import NumberField from '$lib/components/NumberField.svelte';
	import SelectField from '$lib/components/SelectField.svelte';
	import SegmentedField from '$lib/components/SegmentedField.svelte';
	import CheckboxField from '$lib/components/CheckboxField.svelte';
	import Metric from '$lib/components/Metric.svelte';
	import Callout from '$lib/components/Callout.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import DateField from '$lib/components/DateField.svelte';
	import NavIcon, { type NavIconName } from '$lib/icons/NavIcon.svelte';
	import TriangleBackground from './TriangleBackground.svelte';

	// ---------------------------------------------------------------- 색

	const tokens = [
		{ name: 'brand', hex: '#1288f8', role: '큰 요소, 그래프 주 계열' },
		{ name: 'brand-strong', hex: '#0a6fd6', role: '작은 글자·버튼, 활성' },
		{ name: 'ink', hex: '#2b2b2b', role: '본문' },
		{ name: 'navy', hex: '#2a425b', role: '보조 글자, 테두리' },
		{ name: 'cyan', hex: '#00d6fa', role: '장식 전용 (글자 금지)' },
		{ name: 'sky', hex: '#7cd0ff', role: '장식 전용 (글자 금지)' },
		{ name: 'surface', hex: '#ffffff', role: '패널 바탕' },
		{ name: 'wash', hex: '#f2f9ff', role: '배경층' },
		{ name: 'sky-muted', hex: '#a3c5d8', role: '배경 삼각형 둘째 톤' },
		{ name: 'secured', hex: '#0a6fd6', role: '확보' },
		{ name: 'shortfall', hex: '#feaa13', role: '부족 — 면 전용' },
		{ name: 'shortfall-strong', hex: '#9e6501', role: '부족 — 글자' },
		{ name: 'blocked', hex: '#891928', role: '불가, 입력 오류' }
	];

	// 의미 색 — 게임 상성표의 색 (2026-09-29 확정, layout.css 토큰). 색만으로 구분하지 않고 항상 글자와 함께 쓴다
	const semantic = [
		{
			name: '확보',
			fill: 'secured',
			text: 'secured',
			onFill: 'surface',
			note: 'brand-strong과 같은 값',
			sample: '확정으로 데려올 수 있어요'
		},
		{
			name: '부족',
			fill: 'shortfall',
			text: 'shortfall-strong',
			onFill: 'ink',
			note: '면은 상성표 Weak 주황, 글자는 같은 색상을 어둡게',
			sample: '천장까지 3,480개 부족해요'
		},
		{
			name: '불가',
			fill: 'blocked',
			text: 'blocked',
			onFill: 'surface',
			note: '상성표 경장갑·폭발 빨강. 입력 오류에도',
			sample: '이 기간에는 데려올 수 없어요'
		}
	];
	const hex: Record<string, string> = {
		secured: '#0a6fd6',
		shortfall: '#feaa13',
		'shortfall-strong': '#9e6501',
		blocked: '#891928',
		surface: '#ffffff',
		ink: '#2b2b2b'
	};

	function luminance(hex: string): number {
		const [r, g, b] = [1, 3, 5].map((i) => {
			const c = parseInt(hex.slice(i, i + 2), 16) / 255;
			return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
		});
		return 0.2126 * r + 0.7152 * g + 0.0722 * b;
	}
	function contrast(a: string, b: string): string {
		const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
		return ((hi + 0.05) / (lo + 0.05)).toFixed(2);
	}

	// ---------------------------------------------------------------- 글꼴

	const weights = [
		{ cls: 'font-light', label: 'Light 300' },
		{ cls: 'font-medium', label: 'Medium 500' },
		{ cls: 'font-bold', label: 'Bold 700' }
	];
	const sizes = ['text-xs', 'text-sm', 'text-base', 'text-xl', 'text-3xl'];
	const body =
		'천장까지 청휘석 3,480개가 부족해요. 지금 보유분으로 획득할 확률은 75.5%예요. AP는 6분에 1씩, 하루 240까지 자연 회복돼요.';
	const numbers = ['1,111', '8,888', '24,000', '3,120', '119'];

	// ---------------------------------------------------------------- 입력칸 (실제 부품)

	let gems = $state(24000);
	let rank = $state('8');
	let mode = $state('level');
	let checked = $state(true);
	let badExp = $state(3900);
	let badDate = $state('2026-09-01');

	// ---------------------------------------------------------------- 그래프 (5-12)

	const G = { w: 320, h: 180, l: 36, r: 12, t: 12, b: 24 };
	const maxPulls = 200;
	const gx = (p: number) => G.l + (p / maxPulls) * (G.w - G.l - G.r);
	const gy = (v: number) => G.t + (1 - v) * (G.h - G.t - G.b);
	const curve = Array.from({ length: 201 }, (_, p) => {
		const v = p >= 200 ? 1 : 1 - (1 - 0.007) ** p;
		return `${gx(p).toFixed(1)},${gy(v).toFixed(1)}`;
	}).join(' ');

	// ---------------------------------------------------------------- 아이콘

	const icons: { name: NavIconName; label: string }[] = [
		{ name: 'planner', label: '플래너' },
		{ name: 'pity', label: '천장' },
		{ name: 'level', label: '레벨업' },
		{ name: 'gem', label: '수급' }
	];
</script>

<svelte:head>
	<title>스타일 타일 (개발용)</title>
</svelte:head>

<main class="mx-auto flex max-w-5xl flex-col gap-10 px-4 py-8 text-ink">
	<header>
		<p class="text-xs text-navy">개발 중에만 보이는 페이지 · 디자인 통일 3단계</p>
		<h1 class="text-3xl font-bold">스타일 타일</h1>
	</header>

	<!-- 1. 색 -->
	<section class="flex flex-col gap-3">
		<h2 class="text-xl font-bold">1. 색 토큰</h2>
		<div class="grid grid-cols-2 gap-3 md:grid-cols-4">
			{#each tokens as t (t.name)}
				<div class="overflow-hidden rounded border border-navy/15">
					<div class="h-14" style="background: var(--color-{t.name})"></div>
					<div class="p-2 text-xs">
						<p class="font-bold">{t.name}</p>
						<p class="text-navy tabular-nums">{t.hex}</p>
						<p class="text-navy">{t.role}</p>
						<p class="text-navy tabular-nums">
							흰 바탕 {contrast(t.hex, '#ffffff')} · wash {contrast(t.hex, '#f2f9ff')}
						</p>
					</div>
				</div>
			{/each}
		</div>

		<h3 class="mt-2 font-bold">의미 색 — 게임 상성표 색 (토큰 확정)</h3>
		<div class="flex flex-col gap-2">
			{#each semantic as c (c.name)}
				<div
					class="flex flex-wrap items-center gap-3 rounded border border-navy/15 bg-surface px-3 py-2 text-sm"
				>
					<span
						class="w-24 rounded px-2 py-0.5 text-center font-bold"
						style="background: var(--color-{c.fill}); color: var(--color-{c.onFill})">{c.name}</span
					>
					<span class="font-bold" style="color: var(--color-{c.text})">{c.sample}</span>
					<span class="text-xs text-navy tabular-nums">
						면 {c.fill} (위 글자 {contrast(hex[c.fill], hex[c.onFill])}) · 글자 {c.text} (흰 바탕 {contrast(
							hex[c.text],
							'#ffffff'
						)})
					</span>
					<span class="w-full text-xs text-navy">{c.note}</span>
				</div>
			{/each}
		</div>
	</section>

	<!-- 2. 글꼴 -->
	<section class="flex flex-col gap-3">
		<h2 class="text-xl font-bold">2. 글꼴 — 경기천년제목</h2>
		<div class="overflow-x-auto">
			<table class="text-left">
				<thead class="text-xs text-navy">
					<tr>
						<th class="pr-4 font-medium">굵기</th>
						{#each sizes as s (s)}<th class="pr-6 font-medium">{s}</th>{/each}
					</tr>
				</thead>
				<tbody>
					{#each weights as w (w.cls)}
						<tr class="align-baseline">
							<td class="pr-4 text-xs text-navy">{w.label}</td>
							{#each sizes as s (s)}
								<td class="pr-6 whitespace-nowrap {w.cls} {s}">천장 24,000 연</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<h3 class="mt-2 font-bold">본문 후보 — 모바일 14~16px 가독성 (디자인 문서 7장 미결)</h3>
		<div class="grid gap-3 md:grid-cols-2">
			<div>
				<p class="text-xs text-navy">A · Light 16px</p>
				<p class="text-base font-light">{body}</p>
			</div>
			<div>
				<p class="text-xs font-bold text-brand-strong">B · Medium 15px — 선택 (2026-09-29)</p>
				<p class="text-[15px] font-medium">{body}</p>
			</div>
			<div>
				<p class="text-xs text-navy">C · Light 14px</p>
				<p class="text-sm font-light">{body}</p>
			</div>
			<div>
				<p class="text-xs text-navy">D · Medium 14px</p>
				<p class="text-sm font-medium">{body}</p>
			</div>
			<div>
				<p class="text-xs text-navy">비교 · 시스템 글꼴 16px</p>
				<p class="text-base" style="font-family: system-ui, sans-serif">{body}</p>
			</div>
		</div>

		<h3 class="mt-2 font-bold">숫자 자릿수 — 오른쪽 정렬 (Medium 16px)</h3>
		<div class="w-32 text-right font-medium">
			{#each numbers as n (n)}<p>{n}</p>{/each}
		</div>
		<p class="text-xs text-navy">
			0~9가 굵기마다 같은 폭이라 따로 설정하지 않아도 자릿수가 흔들리지 않는다.
		</p>
	</section>

	<!-- 3. 패널 변형 -->
	<section class="flex flex-col gap-3">
		<h2 class="text-xl font-bold">3. 패널 변형 (5단계에서 부품으로)</h2>
		<div class="grid gap-6 md:grid-cols-2">
			<Panel title="Panel 부품 — 모서리 + 표식 (5단계 적용)">
				<p class="text-sm">지금 쓰는 패널. 테두리 navy/15, 바탕 surface.</p>
			</Panel>

			<!-- 구역 제목 탭 -->
			<div class="relative mt-4 rounded border border-navy/60 bg-surface p-4 pt-6">
				<span
					class="absolute -top-3.5 left-3 rounded-t bg-navy px-3 py-1 text-xs font-bold text-white"
				>
					구역 제목 탭
				</span>
				<p class="text-sm">
					패널 위에 제목이 탭처럼 붙는다. 서류철 인덱스 느낌 (5-4 좌측 목록과 같은 결).
				</p>
			</div>

			<!-- 모서리 + 표식 -->
			<div class="relative rounded-sm border border-navy/15 bg-surface p-4">
				{#each ['-top-1.5 -left-1.5', '-top-1.5 -right-1.5', '-bottom-1.5 -left-1.5', '-bottom-1.5 -right-1.5'] as pos (pos)}
					<span class="absolute {pos} text-xs leading-none font-bold text-brand" aria-hidden="true"
						>+</span
					>
				{/each}
				<p class="text-sm font-bold text-brand-strong">모서리 + 표식 — 선택 (2026-09-29)</p>
				<p class="text-sm">네 모서리에 작은 + 표식. 패널 테두리까지만 장식 (3층 구조).</p>
			</div>

			<Panel>
				<p class="mb-2 text-sm font-bold">대화창 카드 (지금 Callout)</p>
				<Callout>AP 구매에 청휘석 1,080개를 써요. 모집 9연분이에요.</Callout>
			</Panel>
		</div>
	</section>

	<!-- 4. 입력칸 -->
	<section class="flex flex-col gap-3">
		<h2 class="text-xl font-bold">4. 입력칸 상태</h2>
		<div class="grid gap-4 md:grid-cols-2">
			<Panel title="실제 부품">
				<div class="flex flex-col gap-3">
					<NumberField
						label="보유 청휘석"
						bind:value={gems}
						hint="하루 청휘석 270"
						help="도움말이 열리는 모양"
					/>
					<SelectField
						label="카페 랭크"
						bind:value={rank}
						options={[
							{ value: '8', label: '8랭크' },
							{ value: '9', label: '9랭크' }
						]}
					/>
					<SegmentedField
						label="계산 방식"
						bind:value={mode}
						options={[
							{ value: 'level', label: '목표 레벨까지' },
							{ value: 'date', label: '날짜까지' }
						]}
					/>
					<CheckboxField label="일일 임무" bind:checked />
				</div>
			</Panel>
			<Panel title="오류 상태 (error 속성, 5단계)">
				<div class="flex flex-col gap-3">
					<NumberField
						label="경험치"
						bind:value={badExp}
						hint="이 레벨에서 쌓은 값 (필요 3,900)"
						error="경험치는 이 레벨의 필요 경험치보다 작아야 해요"
					/>
					<DateField label="날짜" bind:value={badDate} error="날짜는 오늘 이후로 골라주세요" />
					<p class="text-xs text-navy">
						초점은 위 칸들을 눌러 확인 (brand-strong 외곽선). 비활성 상태는 쓰는 곳이 없어 만들지
						않았다.
					</p>
				</div>
			</Panel>
		</div>
	</section>

	<!-- 5. 결과 요소 -->
	<section class="flex flex-col gap-3">
		<h2 class="text-xl font-bold">5. 결과 요소 (5단계 부품)</h2>
		<Panel>
			<div class="mb-3 flex items-start justify-between gap-2">
				<p class="text-xl">천장까지 청휘석 3,480개 부족해요</p>
				<Badge>추정 확률</Badge>
			</div>
			<div class="grid grid-cols-3 gap-2">
				<Metric label="지금 보유분으로 획득" value="75.5%" />
				<Metric label="천장까지 부족" value="3,480" tone="shortfall" />
				<Metric label="확정까지 남은 연차" value="0연" tone="secured" />
			</div>
			<div class="mt-3 flex flex-wrap gap-2">
				<Badge>추정</Badge>
				<Badge tone="secured">확보</Badge>
				<Badge tone="shortfall">부족</Badge>
				<Badge tone="blocked">불가</Badge>
			</div>
			<div class="mt-3"><Callout>AP 구매에 청휘석 1,080개를 써요. 모집 9연분이에요.</Callout></div>
		</Panel>
	</section>

	<!-- 6. 그래프 -->
	<section class="flex flex-col gap-3">
		<h2 class="text-xl font-bold">6. 그래프 — 눈금과 격자 (5-12)</h2>
		<Panel title="연차별 획득 확률">
			<svg viewBox="0 0 {G.w} {G.h}" class="w-full" role="img" aria-label="격자 시안">
				{#each [0, 0.25, 0.5, 0.75, 1] as v (v)}
					<line x1={G.l} x2={G.w - G.r} y1={gy(v)} y2={gy(v)} class="stroke-navy/15" />
					<text
						x={G.l - 4}
						y={gy(v)}
						text-anchor="end"
						dominant-baseline="middle"
						class="fill-navy text-[9px]"
					>
						{v * 100}%
					</text>
				{/each}
				{#each [0, 50, 100, 150, 200] as p (p)}
					<line x1={gx(p)} x2={gx(p)} y1={G.t} y2={G.h - G.b} class="stroke-navy/15" />
					<text x={gx(p)} y={G.h - 8} text-anchor="middle" class="fill-navy text-[9px]">{p}연</text>
				{/each}
				<polyline points={curve} fill="none" stroke-width="2" class="stroke-brand" />
			</svg>
		</Panel>
	</section>

	<!-- 7. 아이콘 -->
	<section class="flex flex-col gap-3">
		<h2 class="text-xl font-bold">7. 기능 아이콘 (6장)</h2>
		<div class="flex flex-wrap gap-8">
			{#each [{ state: '활성', icon: 'text-brand-strong', text: 'font-bold text-brand-strong' }, { state: '비활성', icon: 'text-brand', text: 'text-navy' }, { state: '준비 중', icon: 'text-navy/60', text: 'text-navy/60' }] as s (s.state)}
				<div>
					<p class="mb-2 text-xs text-navy">{s.state}</p>
					<div class="flex gap-4">
						{#each icons as i (i.name)}
							<div class="flex flex-col items-center gap-0.5 text-[11px]">
								<NavIcon name={i.name} class={s.icon} />
								<span class={s.text}>{i.label}</span>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	</section>

	<!-- 8. 배경층 -->
	<section class="flex flex-col gap-3">
		<h2 class="text-xl font-bold">8. 배경층 — 계산기는 사선, 홈은 삼각형 타일</h2>
		<p class="text-sm text-navy">위에 패널을 얹어, 데이터층을 방해하지 않는지 함께 본다.</p>
		<div class="grid gap-4 md:grid-cols-2">
			<div
				class="relative flex h-64 items-center justify-center overflow-hidden rounded border border-navy/15 bg-diagonal"
			>
				<div class="relative w-3/4 rounded-sm border border-navy/15 bg-surface p-4 text-sm">
					<p class="font-bold">사선 — 계산기 화면 (bg-diagonal)</p>
					<p>천장까지 청휘석 3,480개 부족해요</p>
				</div>
			</div>
			<div
				class="relative flex h-64 items-center justify-center overflow-hidden rounded border border-navy/15 bg-wash"
			>
				<TriangleBackground muted="var(--color-sky-muted)" />
				<div class="relative w-3/4 rounded-sm border border-navy/15 bg-surface p-4 text-sm">
					{#each ['-top-1.5 -left-1.5', '-top-1.5 -right-1.5', '-bottom-1.5 -left-1.5', '-bottom-1.5 -right-1.5'] as pos (pos)}
						<span
							class="absolute {pos} text-xs leading-none font-bold text-brand"
							aria-hidden="true">+</span
						>
					{/each}
					<p class="font-bold">삼각형 타일 — 홈 화면</p>
					<p>천장까지 청휘석 3,480개 부족해요</p>
				</div>
			</div>
		</div>
		<div class="flex gap-4 text-xs text-navy">
			<span class="flex items-center gap-1"
				><span class="inline-block size-4 rounded" style="background: #7cd0ff"></span>sky #7cd0ff</span
			>
			<span class="flex items-center gap-1"
				><span class="inline-block size-4 rounded" style="background: var(--color-sky-muted)"
				></span>채도 40% #a3c5d8</span
			>
		</div>
	</section>
</main>
