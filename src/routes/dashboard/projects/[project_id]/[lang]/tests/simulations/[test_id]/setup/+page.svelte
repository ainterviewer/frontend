<script lang="ts">
	import type { PageData } from './$types';
	import FixedAnswers from './FixedAnswers.svelte';
	import ShuffledAI from './ShuffledAI.svelte';
	import FixedAI from './FixedAI.svelte';

	let { data }: { data: PageData } = $props();
	let test = $derived(data.test);
</script>

{#if test.type === 'fixed_answers'}
	<FixedAnswers {test} questions={data.questions} />
{:else if test.type === 'shuffled_ai'}
	<ShuffledAI {test} />
{:else if test.type === 'fixed_ai'}
	<FixedAI {test} />
{:else}
	<p>Unknown test type: {test.type}</p>
{/if}
