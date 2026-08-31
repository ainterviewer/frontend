<script lang="ts">
	import HoverInfo from '$lib/components/HoverInfo.svelte';

	/**
	 * One line of condition prose on a card, with every question number in it
	 * turned into a link to that question's card.
	 *
	 * The numbers are linked rather than the whole line: the reader following a
	 * condition wants the question it reads, and on a page of eighty cards
	 * "1.2" is otherwise a lookup they have to do by hand.
	 */
	let {
		icon,
		text,
		numbers,
		titleFor,
		trailing = null
	}: {
		icon: string;
		text: string;
		/** The question numbers in `text` that have a card to link to. */
		numbers: string[];
		/** The wording behind a question number, for the link's tooltip. */
		titleFor: (number: string) => string | undefined;
		/** An aside after the rule, e.g. how many respondents it kept out. */
		trailing?: string | null;
	} = $props();

	// Split rather than parsed: the summaries are built here (see
	// `conditions.ts`), so a `\d+.\d+` run in one of them is a question number
	// unless the linkable set says otherwise -- an author's own "1.2" inside a
	// trigger value stays plain text.
	let parts = $derived(text.split(/(\d+\.\d+)/g));
	let linkable = $derived(new Set(numbers));
</script>

<div class="flex items-start gap-1.5 text-xs text-amber-700">
	<i class="{icon} mt-0.5 shrink-0 text-[0.6875rem] text-amber-500"></i>
	<span class="min-w-0">
		<!-- Written without whitespace between the tags: the parts are a split
		     sentence, and a newline here becomes a space mid-word. -->
		{#each parts as part, index (index)}{#if linkable.has(part)}<HoverInfo
					text={titleFor(part) ?? ''}
					asChild
					>{#snippet children({ props })}<a
							{...props}
							href="#q-{part.replace('.', '-')}"
							class="font-medium tabular-nums underline decoration-amber-300 underline-offset-2 hover:decoration-amber-600"
							>{part}</a
						>{/snippet}</HoverInfo
				>{:else}{part}{/if}{/each}{#if trailing}<span class="ml-1.5 text-gray-500"
				>· {trailing}</span
			>{/if}
	</span>
</div>
