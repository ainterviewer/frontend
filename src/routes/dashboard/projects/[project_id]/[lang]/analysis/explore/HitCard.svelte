<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { EmbeddingSearchHit } from '$lib/api/types.gen';
	import { format } from 'd3-format';
	import { timeFormat } from 'd3-time-format';
	import ChunkTranscript from './ChunkTranscript.svelte';

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

	/**
	 * The same clamp for the bubble rendering, where lines are not the unit: a
	 * bubble has padding and a gap around it, so six lines of text occupy more
	 * than six lines of box. Roughly the same amount of chunk, measured in the
	 * only thing a stack of bubbles has in common with a paragraph — height.
	 */
	const CLAMP_HEIGHT_REM = 9.5;

	// A chunk the interview's own messages could be found for reads as the
	// conversation it was; one whose messages no longer line up with its
	// coordinates still has the text the model saw, and falls back to it.
	let turns = $derived(hit.turns ?? []);

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

	let body = $state<HTMLElement | null>(null);

	/**
	 * What the reader has said about this card, or `null` while they have said
	 * nothing — in which case the anchor decides.
	 *
	 * The anchor opens expanded: it is the chunk they just clicked, on the map or
	 * on a neighbour, and clamping the one thing they asked for makes "Show more"
	 * the first move of every read. The neighbours around it stay clamped, being
	 * a list to scan rather than the thing being read.
	 *
	 * Held as "unset" rather than initialised from `anchored` so the default
	 * follows a card that becomes the anchor, and so the first server-rendered
	 * paint is already right — an effect correcting it afterwards would show the
	 * clamp for a frame.
	 */
	let toggled = $state<boolean | null>(null);
	let open = $derived(toggled ?? anchored);

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
		const element = body;
		if (!element) return;

		// Re-measure when the text itself changes, not only when the box resizes:
		// the panel reuses these cards as the reader moves between chunks.
		void hit.text;
		void turns;

		const measure = () => {
			// Against the clamp rather than against the element's own box, which is
			// only the clamp while the card is collapsed. An anchor opens expanded,
			// and asking an expanded element whether it overflows always answers no
			// — which is how the card that most needs "Show less" ended up without
			// one. `scrollHeight` is the full content height in both states.
			const style = getComputedStyle(element);
			const line = parseFloat(style.lineHeight);
			const limit =
				turns.length > 0
					? CLAMP_HEIGHT_REM * parseFloat(getComputedStyle(document.documentElement).fontSize)
					: CLAMP_LINES * (Number.isFinite(line) ? line : parseFloat(style.fontSize) * 1.5);
			overflowing = element.scrollHeight > limit + 1;
		};

		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(element);
		return () => observer.disconnect();
	});

	// A chunk the reader expanded, then anchored, then came back to should not
	// still be open behind a different chunk's text — and an anchor that becomes
	// a different anchor opens again, since it is again what was asked for.
	$effect(() => {
		void hit.id;
		toggled = null;
	});
</script>

<div
	class="rounded-lg border p-3 transition-colors"
	class:border-primary={anchored}
	class:border-gray-200={!anchored}
>
	{#if turns.length > 0}
		<!-- Faded at the cut rather than sliced. A height clamp lands wherever it
		     lands, which for a bubble is usually mid-word through a coloured box
		     — that reads as a rendering fault, where a fade reads as "there is
		     more", which is what the button below it says. -->
		<div
			bind:this={body}
			style={open
				? undefined
				: `max-height:${CLAMP_HEIGHT_REM}rem;overflow:hidden` +
					(overflowing
						? ';mask-image:linear-gradient(to bottom,#000 75%,transparent);-webkit-mask-image:linear-gradient(to bottom,#000 75%,transparent)'
						: '')}
		>
			<ChunkTranscript {turns} />
		</div>
	{:else}
		<p
			bind:this={body}
			class="text-sm whitespace-pre-line text-gray-800"
			style={open
				? undefined
				: `display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:${CLAMP_LINES};overflow:hidden`}
		>
			{hit.text ?? 'No text stored for this chunk.'}
		</p>
	{/if}

	{#if overflowing}
		<button
			type="button"
			onclick={() => (toggled = !open)}
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
