<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { PageData } from './$types';
	import FixedAnswers from './FixedAnswers.svelte';
	import ShuffledAI from './ShuffledAI.svelte';
	import FixedAI from './FixedAI.svelte';

	let { data }: { data: PageData } = $props();
	let test = $derived(data.test);
	let projectId = $derived(page.params.project_id);
	let lang = $derived(page.params.lang);
</script>

<div class="flex min-h-full flex-col">
	<a
		href={resolve(`/dashboard/projects/${projectId}/${lang}/tests/simulations`)}
		class="mb-4 inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-primary"
	>
		<i class="fa-solid fa-arrow-left"></i>
		Back to simulations
	</a>

	{#if test.type === 'fixed_answers'}
		<FixedAnswers {test} questions={data.questions} />
	{:else if test.type === 'shuffled_ai'}
		<ShuffledAI {test} />
	{:else if test.type === 'fixed_ai'}
		<FixedAI {test} />
	{:else}
		<p>Unknown test type: {test.type}</p>
	{/if}
</div>
