<script lang="ts">
	import type { EmbeddingTurn } from '$lib/api/types.gen';
	let {
		turns,
		compact = true
	}: {
		turns: EmbeddingTurn[];
		/**
		 * Sized for the results panel rather than for the interview screen. The
		 * bubbles are the same ones — same sides, same colours — because a
		 * researcher reading a hit here and the transcript there is reading one
		 * conversation, and two renderings of it would be two things to learn.
		 */
		compact?: boolean;
	} = $props();

	/**
	 * A turn split into runs, each labelled with why it is marked.
	 *
	 * The ranges come from the server — it ran the query, so it is the only side
	 * that knows whether a word in an interviewer's turn counted under the scope
	 * that was asked for. Segments rather than marked-up HTML: respondent text is
	 * escaped before it is displayed, and building a string of tags around it
	 * would be the one place that stopped being true.
	 *
	 * `excluded` are words the query asked *not* to see, which can still be on
	 * screen — in text the scope never searched, or in a sibling turn of a
	 * grouped chunk. The server has already made sure the two lists do not
	 * overlap, so the merge below cannot mark a character twice.
	 */
	type Mark = 'match' | 'excluded' | null;

	function segments(turn: EmbeddingTurn): { text: string; mark: Mark }[] {
		const spans: { start: number; end: number; mark: Mark }[] = [
			...(turn.matches ?? []).map(([start, end]) => ({ start, end, mark: 'match' as const })),
			...(turn.excluded ?? []).map(([start, end]) => ({ start, end, mark: 'excluded' as const }))
		].sort((a, b) => a.start - b.start);

		if (spans.length === 0) return [{ text: turn.text, mark: null }];

		const parts: { text: string; mark: Mark }[] = [];
		let last = 0;
		for (const span of spans) {
			if (span.start > last) parts.push({ text: turn.text.slice(last, span.start), mark: null });
			parts.push({ text: turn.text.slice(span.start, span.end), mark: span.mark });
			last = span.end;
		}
		if (last < turn.text.length) parts.push({ text: turn.text.slice(last), mark: null });
		return parts;
	}
</script>

<div class="flex flex-col gap-1.5">
	{#each turns as turn, index (index)}
		{@const respondent = turn.role === 'respondent'}
		<div class="flex w-full" class:justify-end={respondent}>
			<div
				class="max-w-[90%] rounded-xl break-words hyphens-auto whitespace-pre-line
					{compact ? 'px-2.5 py-1.5 text-[0.8125rem]' : 'p-2.5 text-sm'}
					{respondent ? 'rounded-br-sm bg-primary text-on-primary' : 'rounded-bl-sm bg-[#eee] text-gray-900'}"
			>
				{#if turn.survey_label}
					<!-- An identical "Agree" from forty respondents is a click, not a
					     consensus, and a bubble that does not say so reads as writing. -->
					<span
						class="mb-1 inline-block rounded bg-black/10 px-1.5 py-0.5 text-[0.625rem] font-medium tracking-wide uppercase"
					>
						{turn.survey_label}
					</span>
					<br />
				{/if}{#each segments(turn) as segment, part (part)}{#if segment.mark === 'match'}<mark
							class="rounded-sm bg-yellow-300/90 px-0.5 text-gray-900"
							title="Matched your search">{segment.text}</mark
						>{:else if segment.mark === 'excluded'}<mark
							class="rounded-sm bg-red-200/90 px-0.5 text-gray-900 line-through decoration-red-700/50"
							title="You excluded this word — it is here, but it is not why this chunk is in the results"
							>{segment.text}</mark
						>{:else}{segment.text}{/if}{/each}
			</div>
		</div>
	{/each}
</div>
