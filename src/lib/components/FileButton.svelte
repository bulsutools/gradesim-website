<script lang="ts">
	import Icon from './Icon.svelte';

	let { label, onFile, quiet = false, accept = '.json,application/json' }: { label: string; onFile: (f: File) => void; quiet?: boolean; accept?: string } = $props();
	let input: HTMLInputElement | undefined = $state();
</script>

<button class={quiet ? 'textbtn' : 'btn btn-secondary'} type="button" onclick={() => input?.click()}>
	<Icon name="upload" />{label}
</button>
<input
	bind:this={input}
	type="file"
	{accept}
	hidden
	data-testid="file-input"
	onchange={(e) => {
		const f = e.currentTarget.files?.[0];
		e.currentTarget.value = '';
		if (f) onFile(f);
	}}
/>
