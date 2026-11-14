<!--
	관리자 로그인 (docs/006 5-2). 이메일 + 비밀번호. 새 가입은 Supabase에서 꺼 두었고,
	관리자 계정은 대시보드에서 만들어 admins 표에 넣은 것만 관리자로 인정된다.
-->
<script lang="ts">
	import Panel from '$lib/components/Panel.svelte';
	import AdminButton from './AdminButton.svelte';
	import TextField from './TextField.svelte';

	/** 로그인을 시도하고, 실패하면 화면에 보일 문장을 돌려준다 */
	let { signIn }: { signIn: (email: string, password: string) => Promise<string | null> } =
		$props();

	let email = $state('');
	let password = $state('');
	let pending = $state(false);
	let error = $state<string | null>(null);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (pending || !email.trim() || !password) return;
		pending = true;
		error = await signIn(email.trim(), password);
		pending = false;
		if (error) password = '';
	}
</script>

<Panel title="관리자 로그인" class="w-full max-w-md">
	<form onsubmit={submit} class="flex flex-col gap-5">
		<TextField label="이메일" type="email" autocomplete="username" bind:value={email} />
		<TextField
			label="비밀번호"
			type="password"
			autocomplete="current-password"
			bind:value={password}
		/>
		{#if error}
			<p role="alert" class="text-sm font-bold text-blocked">{error}</p>
		{/if}
		<div>
			<AdminButton variant="primary" type="submit" disabled={pending || !email.trim() || !password}>
				{pending ? '확인하는 중…' : '로그인'}
			</AdminButton>
		</div>
	</form>
</Panel>
