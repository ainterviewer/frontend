<script lang="ts">
	import type { EmbeddingSearchHit } from '$lib/api/types.gen';
	import { format } from 'd3-format';
	import { timeFormat } from 'd3-time-format';
	import ChunkTranscript from './ChunkTranscript.svelte';

	let {
		hit,
		showScore = true,
		anchored = false,
		onanchor,
		ontranscript
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
		/**
		 * Read the whole interview this came from.
		 *
		 * A callback rather than a link to the transcript page: a card is a
		 * fragment of a conversation, and deciding whether it means what it looks
		 * like it means almost always takes the turn before or after it. Navigating
		 * away to find that costs the reader the list, the filters and their place
		 * in the mosaic, and they were only ever going to come straight back.
		 */
		ontranscript: (hit: EmbeddingSearchHit) => void;
	} = $props();

	const formatScore = format('.2f');
	const formatDate = timeFormat('%d %b %Y');

	// A chunk the interview's own messages could be found for reads as the
	// conversation it was; one whose messages no longer line up with its
	// coordinates still has the text the model saw, and falls back to it.
	let turns = $derived(hit.turns ?? []);

	let date = $derived(
		hit.interview_created_at ? formatDate(new Date(hit.interview_created_at)) : null
	);
</script>

<div
	class="rounded-lg border p-3 transition-colors"
	class:border-primary={anchored}
	class:border-gray-200={!anchored}
>
	<!-- Whole, never clamped. A chunk is a conversation and the part a clamp
	     takes off is the answer -- the only half that differs between
	     respondents. A card that stopped short was a card asking to be opened
	     before it could be read, which is what the mosaic is supposed to save
	     the reader from. Length is information here: a long card is a long
	     answer, and seeing that at a glance is worth the scrolling. -->
	{#if turns.length > 0}
		<ChunkTranscript {turns} />
	{:else}
		<p class="text-sm whitespace-pre-line text-gray-800">
			{hit.text ?? 'No text stored for this chunk.'}
		</p>
	{/if}

	<div class="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.6875rem] text-gray-400">
		<!-- A browsed row carries no score, so `showScore` alone is not enough:
		     the card is the same card either way, and the badge is simply not
		     one of the things it can say about this row. -->
		{#if showScore && hit.score !== null && hit.score !== undefined}
			<span class="rounded bg-gray-100 px-1.5 py-0.5 font-mono font-medium text-gray-600">
				{formatScore(hit.score)}
			</span>
		{/if}
		<!-- Which interview, in two forms that are not alternatives to each
		     other. The number identifies the interview inside this project and is
		     always there; the pid identifies a person across projects and usually
		     is not. The number is here mainly so a reader scanning the mosaic can
		     see at a glance which cards are the same conversation, which is
		     otherwise only knowable by opening them.

		     The question number used to sit here too. It is on the messages now:
		     a card is a question group, its probes carry different numbers, and
		     one number in the footer could only ever be the group's. -->
		{#if hit.interview_number}
			<span class="font-mono" title="Interview {hit.interview_number} in this project">
				#{hit.interview_number}
			</span>
		{/if}
		{#if hit.participant_pid}
			<span>{hit.participant_pid}</span>
		{/if}
		<span class="uppercase">{hit.language}</span>
		{#if date}
			<span>{date}</span>
		{/if}

		<span class="ml-auto flex items-center gap-3">
			{#if onanchor}
				<!-- Re-anchoring is how the reader walks the space: every chunk's
				     neighbours are a different question than the last one's, and
				     `/similar` reuses the stored vector, so a step costs no inference
				     and works even with the embedding server down.

				     The same control releases the anchor when it is already this
				     chunk's. A reader who anchored by clicking here looks here to
				     undo it, and a toggle is one thing to learn rather than two. -->
				<button
					type="button"
					onclick={() => onanchor?.(hit)}
					aria-pressed={anchored}
					class="flex cursor-pointer items-center gap-1 font-medium {anchored
						? 'text-primary'
						: 'text-gray-500 hover:text-primary'}"
					title={anchored
						? 'Stop showing what is nearest this chunk'
						: 'Show what is nearest this chunk'}
				>
					<i class="fas fa-anchor text-[0.625rem]"></i>Anchor
				</button>
			{:else if anchored}
				<!-- Anchored, but with nothing to release it: a label, not a button. -->
				<span class="flex items-center gap-1 font-medium text-primary">
					<i class="fas fa-anchor text-[0.625rem]"></i>Anchor
				</span>
			{/if}
			<button
				type="button"
				onclick={() => ontranscript(hit)}
				class="cursor-pointer font-medium text-primary hover:underline"
				title="Read the whole interview this is from"
			>
				Transcript
			</button>
		</span>
	</div>
</div>
