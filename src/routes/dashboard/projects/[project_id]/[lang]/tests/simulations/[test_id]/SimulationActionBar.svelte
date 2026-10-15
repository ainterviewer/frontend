<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	// The setup saves itself as it is edited (`AutosavePill`); there is no Save.
	let { current }: { current: 'setup' | 'runs' } = $props();

	const projectId = $derived(page.params.project_id);
	const lang = $derived(page.params.lang);
	const testId = $derived(page.params.test_id);
</script>

<div
	data-action-bar
	class="sticky bottom-0 z-20 mt-auto ml-auto flex w-fit gap-4 rounded-full border border-gray-200 bg-white/90 p-4 shadow-lg backdrop-blur"
>
	<!-- mt-auto keeps the bar at the foot of the page when the content is too short
	     to fill the viewport; sticky keeps it in view when it is not. z-20 keeps it
	     above a DataTable's sticky header cells (z-10). A comment must not lead this
	     template: as a second root node it breaks hydration. -->
	{#if current === 'setup'}
		<a
			class="rounded-full bg-gray-100 px-6 py-2 font-medium text-gray-700 hover:bg-gray-200"
			href={resolve(`/dashboard/projects/${projectId}/${lang}/tests/simulations/${testId}/runs`)}
		>
			Runs
		</a>
	{:else}
		<a
			class="rounded-full bg-gray-100 px-6 py-2 font-medium text-gray-700 hover:bg-gray-200"
			href={resolve(`/dashboard/projects/${projectId}/${lang}/tests/simulations/${testId}/setup`)}
		>
			Setup
		</a>
	{/if}
</div>
