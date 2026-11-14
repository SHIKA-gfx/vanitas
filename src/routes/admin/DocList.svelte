<!--
	데이터 문서 목록 (docs/006 6-3-3, ④-4). 파일이 아니라 계산기별 묶음으로 (doc-sections.ts).
	묶음마다 무엇인지 한 줄, 어느 파일인지, 사이트에 반영 전인지
-->
<script lang="ts">
	import Badge from '$lib/components/Badge.svelte';
	import Panel from '$lib/components/Panel.svelte';
	import NavIcon from '$lib/icons/NavIcon.svelte';
	import { DOC_GROUPS, type DocSection } from './doc-sections';

	interface Props {
		/** 묶음 id → 사이트와 다른가 */
		pending: ReadonlySet<string>;
		onedit: (section: DocSection) => void;
	}
	let { pending, onedit }: Props = $props();
</script>

<Panel title="데이터 문서">
	<div class="flex flex-col gap-6">
		<p class="text-xs leading-relaxed text-navy">
			계산기마다 쓰는 값을 묶어 두었어요. 저장하기 전에 빌드와 같은 검사(validate.py)를 이
			브라우저에서 돌려요.
		</p>
		{#each DOC_GROUPS as group (group.id)}
			<section class="flex flex-col gap-2" aria-labelledby="doc-group-{group.id}">
				<h2 id="doc-group-{group.id}" class="flex items-center gap-2 text-sm font-bold text-ink">
					{#if group.icon}
						<NavIcon name={group.icon} size={20} class="text-brand-strong" />
					{/if}
					{group.title}
				</h2>
				<ul class="flex flex-col gap-1.5">
					{#each group.sections as s (s.id)}
						<li>
							<button
								type="button"
								class="flex w-full items-start gap-3 rounded-lg bg-wash px-3 py-2.5 text-left hover:bg-slot focus-visible:outline-2 focus-visible:outline-brand-strong"
								onclick={() => onedit(s)}
							>
								<span class="min-w-0 flex-1">
									<span class="flex flex-wrap items-center gap-x-2 gap-y-1">
										<span class="text-sm font-medium text-ink">{s.title}</span>
										{#if pending.has(s.id)}
											<Badge>반영 전</Badge>
										{/if}
									</span>
									<span class="mt-0.5 block text-xs text-navy">{s.description}</span>
									<span class="mt-0.5 block font-mono text-[0.6875rem] text-navy/80"
										>{s.path} · {s.keys.join(', ')}</span
									>
								</span>
								<span class="shrink-0 pt-0.5 text-sm font-bold text-brand-strong">고치기</span>
							</button>
						</li>
					{/each}
				</ul>
			</section>
		{/each}
	</div>
</Panel>
