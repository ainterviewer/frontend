<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	let {
		current,
		saving = false,
		saveLabel = 'Save Setup',
		onSave
	}: {
		current: 'setup' | 'runs';
		saving?: boolean;
		saveLabel?: string;
		onSave?: () => Promise<void> | void;
	} = $props();

	const projectId = $derived(page.params.project_id);
	const lang = $derived(page.params.lang);
	const testId = $derived(page.params.test_id);
</script>

<!-- mt-auto keeps the bar at the foot of the page when the content is too short
     to fill the viewport; sticky keeps it in view when it is not. z-20 keeps it
     above a DataTable's sticky header cells (z-10). -->
<div
	class="sticky bottom-0 z-20 mt-auto ml-auto flex w-fit gap-4 rounded-full border border-gray-200 bg-white/90 p-4 shadow-lg backdrop-blur"
>
	{#if current === 'setup'}
		<a
			class="rounded-full bg-gray-100 px-6 py-2 font-medium text-gray-700 hover:bg-gray-200"
			href={resolve(`/dashboard/projects/${projectId}/${lang}/tests/simulations/${testId}/runs`)}
		>
			Runs
		</a>
		<button
			type="button"
			class="flex items-center gap-2 rounded-full bg-primary px-6 py-2 font-medium text-white shadow-sm hover:bg-dark disabled:cursor-not-allowed disabled:opacity-50"
			onclick={() => onSave?.()}
			disabled={saving}
		>
			{#if saving}
				<i class="fas fa-spinner fa-spin"></i>
				Saving...
			{:else}
				<i class="fa-solid fa-floppy-disk"></i>
				{saveLabel}
			{/if}
		</button>
	{:else}
		<a
			class="rounded-full bg-gray-100 px-6 py-2 font-medium text-gray-700 hover:bg-gray-200"
			href={resolve(`/dashboard/projects/${projectId}/${lang}/tests/simulations/${testId}/setup`)}
		>
			Setup
		</a>
	{/if}
</div>
