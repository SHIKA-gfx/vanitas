<script lang="ts">
	interface Option {
		value: string;
		label: string;
	}

	interface Props {
		label: string;
		value: string;
		options: Option[];
	}

	let { label, value = $bindable(), options }: Props = $props();
	const id = $props.id();
</script>

<div>
	<label for={id} class="mb-1 block text-sm text-navy">{label}</label>
	<select
		{id}
		bind:value
		class="w-full rounded border border-navy/60 bg-surface px-3 py-2 text-ink focus:outline-2 focus:outline-brand-strong"
	>
		{#each options as option (option.value)}
			<option value={option.value}>{option.label}</option>
		{/each}
	</select>
</div>
