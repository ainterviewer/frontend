<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	/**
	 * Opens a manual test that starts at this section or question, in the
	 * language being edited. The backend cuts the test's copy of the guide down
	 * to what comes from here on; the introduction, consent and welcome are
	 * skipped. Mirrors "Try Interview" in the action bar.
	 */
	let {
		kind,
		id,
		dataTour,
		blocked
	}: {
		kind: 'section' | 'question';
		id: string;
		dataTour?: string;
		/** Why the test may not start, if it may not: the guide is invalid. */
		blocked?: string;
	} = $props();

	const href = $derived(
		resolve(
			`/interview?id=${page.params.project_id}&interview_type=manual_test&lang=${page.params.lang}&start_${kind}=${id}`
		)
	);
	const title = $derived(`Try the interview from this ${kind}`);
</script>

{#if blocked}
	<span
		data-tour={dataTour}
		role="link"
		aria-disabled="true"
		tabindex="0"
		title={blocked}
		aria-label="{title}: {blocked}"
		class="cursor-not-allowed rounded-md p-1.5 text-gray-300"
	>
		<i class="fa-solid fa-play"></i>
	</span>
{:else}
	<a
		data-tour={dataTour}
		{href}
		target="_blank"
		rel="opener"
		{title}
		aria-label={title}
		class="cursor-pointer rounded-md p-1.5 text-gray-700 transition-colors hover:text-primary"
	>
		<i class="fa-solid fa-play"></i>
	</a>
{/if}
