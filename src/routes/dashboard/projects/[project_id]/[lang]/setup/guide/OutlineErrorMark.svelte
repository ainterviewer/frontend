<script lang="ts">
	import type { ContentError } from '$lib/api';
	import { reveal } from '$lib/collab/reveal';

	/**
	 * In the outline, on the line of a question (or section) the guide has a
	 * problem in: what it is on hover, and a click goes there with the panel the
	 * problem is in opened, as from the invalid pill's list. Its line drops its
	 * right padding while it shows, so the mark sits just after the text.
	 */
	let { id, errors }: { id: string; errors: ContentError[] } = $props();

	let title = $derived(errors.map((error) => error.message).join('\n'));
</script>

{#if errors.length > 0}
	<button
		type="button"
		class="mr-1 shrink-0 cursor-pointer px-1 text-xs text-red-500 hover:text-red-700"
		{title}
		aria-label={title}
		onclick={() => reveal(id, errors[0].field ?? null)}
	>
		<i class="fas fa-circle-exclamation" aria-hidden="true"></i>
	</button>
{/if}
