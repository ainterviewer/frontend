<script lang="ts">
	import type { EmbeddingTurn } from '$lib/api/types.gen';

	let {
		turns,
		compact = true,
		highlightMatch = false
	}: {
		turns: EmbeddingTurn[];
		/**
		 * Sized for the results panel rather than for the interview screen. The
		 * bubbles are the same ones — same sides, same colours — because a
		 * researcher reading a hit here and the transcript there is reading one
		 * conversation, and two renderings of it would be two things to learn.
		 */
		compact?: boolean;
		/**
		 * Whether to ring the turn the chunk is about.
		 *
		 * Off unless something is actually being searched for. `match` marks
		 * which turn a chunk is *of*, not which turn answered a question the
		 * reader asked — so with no query and no keyword the ring highlights
		 * every card identically, which is the same as highlighting nothing
		 * while looking like it means something.
		 */
		highlightMatch?: boolean;
	} = $props();
</script>

<div class="flex flex-col gap-1.5">
	{#each turns as turn, index (index)}
		{@const respondent = turn.role === 'respondent'}
		<div class="flex w-full" class:justify-end={respondent}>
			<div
				class="max-w-[90%] rounded-xl break-words hyphens-auto whitespace-pre-line
					{compact ? 'px-2.5 py-1.5 text-[0.8125rem]' : 'p-2.5 text-sm'}
					{respondent ? 'rounded-br-sm bg-primary text-on-primary' : 'rounded-bl-sm bg-[#eee] text-gray-900'}"
				class:ring-2={highlightMatch && turn.match}
				class:ring-primary={highlightMatch && turn.match}
				class:ring-offset-1={highlightMatch && turn.match}
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
				{/if}{turn.text}
			</div>
		</div>
	{/each}
</div>
