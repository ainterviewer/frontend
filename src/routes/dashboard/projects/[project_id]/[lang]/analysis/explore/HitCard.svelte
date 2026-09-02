<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { EmbeddingSearchHit } from '$lib/api/types.gen';
	import { format } from 'd3-format';
	import { timeFormat } from 'd3-time-format';

	let {
		hit,
		showScore = true,
		anchored = false,
		onanchor
	}: {
		hit: EmbeddingSearchHit;
		/**
		 * A score is a distance from something. It means something for a search
		 * hit or a neighbour and nothing for a cluster representative, which was
		 * picked for being central rather than for matching a query.
		 */
		showScore?: boolean;
		/** This chunk is the one the neighbours are measured from. */
		anchored?: boolean;
		onanchor?: (hit: EmbeddingSearchHit) => void;
	} = $props();

	const formatScore = format('.2f');
	const formatDate = timeFormat('%d %b %Y');

	/**
	 * How much of a chunk to show before clamping.
	 *
	 * A Q&A pair is a small transcript — question, answer, and every probe that
	 * followed — so a list of them unclamped is a wall, and a list of them
	 * clamped to two lines is a column of identical questions. Six is enough to
	 * clear the question and reach the answer, which is the part being compared.
	 */
	const CLAMP_LINES = 6;

	let interviewHref = $derived(
		resolve(
			`/dashboard/projects/${page.params.project_id}/${page.params.lang ?? 'en'}/interviews/${hit.interview_id}`
		)
	);

	// Question numbering as the guide writes it, when the chunk has one. An
	// interview-level chunk has none, and a message that came before the first
	// question has none either.
	let questionLabel = $derived(
		hit.section !== null && hit.main_question !== null
			? `Q${hit.section + 1}.${hit.main_question + 1}${hit.sub_question !== null ? `.${hit.sub_question + 1}` : ''}`
			: null
	);

	let date = $derived(
		hit.interview_created_at ? formatDate(new Date(hit.interview_created_at)) : null
	);

	let paragraph = $state<HTMLParagraphElement | null>(null);
	let open = $state(false);

	// Whether the clamp is actually hiding anything. A character count is the
	// obvious stand-in and the wrong one: a chunk can run well past any
	// threshold and still fit its lines at this width, which leaves a "Show
	// more" that reveals nothing. Only the layout knows, so ask the layout.
	//
	// Deliberately not shared with the report's `ClampedText`: that one is a
	// paragraph of caption text at its own size and colour, and the two would
	// have to grow a styling API to stay one component. The measurement is
	// short; the abstraction would not be.
	let overflowing = $state(false);

	$effect(() => {
		const element = paragraph;
		if (!element) return;

		// Re-measure when the text itself changes, not only when the box resizes:
		// the panel reuses these cards as the reader moves between chunks.
		void hit.text;

		const measure = () => {
			// Meaningful only while clamped — expanded, the element is its own full
			// height and nothing ever looks clipped. The last clamped verdict
			// stands, which is what keeps "Show less" on screen.
			if (open) return;
			overflowing = element.scrollHeight > element.clientHeight + 1;
		};

		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(element);
		return () => observer.disconnect();
	});

	// A chunk the reader expanded, then anchored, then came back to should not
	// still be open behind a different chunk's text.
	$effect(() => {
		void hit.id;
		open = false;
	});
</script>

<div
	class="rounded-lg border p-3 transition-colors"
	class:border-primary={anchored}
	class:border-gray-200={!anchored}
>
	<p
		bind:this={paragraph}
		class="text-sm whitespace-pre-line text-gray-800"
		style={open
			? undefined
			: `display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:${CLAMP_LINES};overflow:hidden`}
	>
		{hit.text ?? 'No text stored for this chunk.'}
	</p>

	{#if overflowing}
		<button
			type="button"
			onclick={() => (open = !open)}
			class="mt-1 cursor-pointer text-xs font-medium text-primary hover:underline"
		>
			{open ? 'Show less' : 'Show more'}
		</button>
	{/if}

	<div class="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.6875rem] text-gray-400">
		{#if showScore}
			<span class="rounded bg-gray-100 px-1.5 py-0.5 font-mono font-medium text-gray-600">
				{formatScore(hit.score)}
			</span>
		{/if}
		{#if questionLabel}
			<span>{questionLabel}</span>
		{/if}
		{#if hit.participant_pid}
			<span>{hit.participant_pid}</span>
		{/if}
		<span class="uppercase">{hit.language}</span>
		{#if hit.interview_status}
			<span>{hit.interview_status}</span>
		{/if}
		{#if date}
			<span>{date}</span>
		{/if}

		<span class="ml-auto flex items-center gap-3">
			{#if anchored}
				<span class="flex items-center gap-1 font-medium text-primary">
					<i class="fas fa-anchor text-[0.625rem]"></i>Anchor
				</span>
			{:else if onanchor}
				<!-- Re-anchoring is how the reader walks the space: every chunk's
				     neighbours are a different question than the last one's, and
				     `/similar` reuses the stored vector, so a step costs no inference
				     and works even with the embedding server down. -->
				<button
					type="button"
					onclick={() => onanchor?.(hit)}
					class="flex cursor-pointer items-center gap-1 font-medium text-gray-500 hover:text-primary"
					title="Show what is nearest this chunk"
				>
					<i class="fas fa-anchor text-[0.625rem]"></i>Anchor
				</button>
			{/if}
			<a href={interviewHref} class="font-medium text-primary hover:underline">Transcript</a>
		</span>
	</div>
</div>
