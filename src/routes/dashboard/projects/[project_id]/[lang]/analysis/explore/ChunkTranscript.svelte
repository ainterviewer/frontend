<script lang="ts">
	import type { EmbeddingTurn, TranscriptTurn } from '$lib/api/types.gen';
	import MessageBubble from '$lib/components/interview/MessageBubble.svelte';
	import type { SurveyItemUnion } from '$lib/components/interview/types';

	let {
		turns,
		compact = true
	}: {
		/**
		 * A chunk's turns, or a whole interview's.
		 *
		 * `TranscriptTurn` is an `EmbeddingTurn` with the guide coordinates and
		 * the survey item added, so the two are one list as far as this is
		 * concerned: what a turn carries decides what its bubble shows, and a
		 * card simply carries less than a transcript does.
		 */
		turns: (EmbeddingTurn | TranscriptTurn)[];
		/**
		 * Sized for the results panel rather than for the interview screen. The
		 * bubbles are the same ones — `MessageBubble`, shared with the interview
		 * and the transcript page — because a researcher reading a hit here and
		 * the transcript there is reading one conversation, and two renderings of
		 * it would be two things to learn.
		 */
		compact?: boolean;
	} = $props();

	// Keyed on `id` rather than on a coordinate: both kinds of turn carry the
	// guide coordinates now, and only a transcript turn carries the message row
	// it came from.
	function isTranscript(turn: EmbeddingTurn | TranscriptTurn): turn is TranscriptTurn {
		return 'id' in turn;
	}

	/**
	 * The attached image, in the shape the bubble draws.
	 *
	 * `data` is nullable on the wire — an image row whose payload was never
	 * stored — and an `<img>` with no source is a broken icon where the reader
	 * expects a picture, so a missing one is simply no image.
	 */
	function picture(turn: EmbeddingTurn | TranscriptTurn): { data: string; alt?: string } | null {
		if (!isTranscript(turn) || !turn.image?.data) return null;
		return { data: turn.image.data, alt: turn.image.alt };
	}

	/**
	 * The survey item this turn's answer was chosen from, when the caller has it.
	 *
	 * Only a transcript carries the whole item; a card carries its type, which
	 * `survey_label` renders as a badge instead.
	 */
	function survey(turn: EmbeddingTurn | TranscriptTurn): SurveyItemUnion | null {
		return isTranscript(turn) ? (turn.survey_item ?? null) : null;
	}

	/**
	 * The turn's text, or nothing where the option set says it better.
	 *
	 * A chosen option is stored as its own label — the answer to a radio is the
	 * string "Male" — so rendering both the text and the item would print the
	 * answer twice, once bare and once inside the control it was picked in. The
	 * transcript page drops the text for exactly this reason; doing it here is
	 * the same rule in the one place both now go through.
	 */
	function body(turn: EmbeddingTurn | TranscriptTurn): string {
		return survey(turn) ? '' : turn.text;
	}

	/**
	 * The guide number, spelled the way the transcript page spells it: `3.1` for
	 * a main question, `3.2.1` for the first probe under it.
	 *
	 * On the message rather than in the card's footer, which is where the card
	 * used to say it once for the whole chunk. A chunk is a question group and
	 * its probes are numbered apart — the footer could only ever say the group's
	 * number, and saying it on each turn is both truer and what the transcript
	 * this opens into already does.
	 *
	 * Null where the guide never numbered the turn: an interview-level chunk, or
	 * a message said before the first question.
	 */
	function label(turn: EmbeddingTurn | TranscriptTurn): string | null {
		if (turn.section === null || turn.section === undefined) return null;
		let out = `${turn.section + 1}`;
		if (turn.main_question !== null && turn.main_question !== undefined) {
			out += `.${turn.main_question + 1}`;
			if (turn.sub_question) out += `.${turn.sub_question}`;
		}
		return out;
	}
</script>

<div class="flex flex-col {compact ? 'gap-1.5' : ''}">
	{#each turns as turn, index (index)}
		<MessageBubble
			interviewer={turn.role !== 'respondent'}
			text={body(turn)}
			label={label(turn)}
			surveyItem={survey(turn)}
			surveyLabel={turn.survey_label ?? null}
			image={picture(turn)}
			answer={turn.text}
			matches={turn.matches ?? []}
			excluded={turn.excluded ?? []}
			skipped={isTranscript(turn) ? (turn.skipped ?? false) : false}
			{compact}
		/>
	{/each}
</div>
