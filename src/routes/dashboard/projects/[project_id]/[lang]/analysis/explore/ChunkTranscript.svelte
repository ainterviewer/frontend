<script lang="ts">
	import type { EmbeddingTurn, TranscriptTurn } from '$lib/api/types.gen';
	import CodingChips from '$lib/components/analysis/CodingChips.svelte';
	import MessageBubble from '$lib/components/interview/MessageBubble.svelte';
	import type { SurveyItemUnion } from '$lib/components/interview/types';
	import { questionKey, type ConditionSummary } from '$lib/analysis/conditions';
	import { isSpan } from '$lib/utils/coding';
	import { selectionWithin } from '$lib/utils/textSelection';
	import { turnIds, useCodingSurface } from './codingSurface.svelte';

	let {
		turns,
		conditions = new Map(),
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
		 * The guide's conditions, keyed by question — see
		 * `$lib/analysis/conditions`.
		 *
		 * Passed in rather than fetched here because one guide serves a whole
		 * mosaic of these, and a component that fetched its own would fetch it
		 * once per card. Empty by default: a caller without the guide draws the
		 * turns and says nothing about gates, which is what it knows.
		 */
		conditions?: Map<string, ConditionSummary>;
		/**
		 * Sized for the results panel rather than for the interview screen. The
		 * bubbles are the same ones — `MessageBubble`, shared with the interview
		 * and the transcript page — because a researcher reading a hit here and
		 * the transcript there is reading one conversation, and two renderings of
		 * it would be two things to learn.
		 */
		compact?: boolean;
	} = $props();

	/**
	 * Coding, when the page offers it — see `codingSurface.svelte`.
	 *
	 * `null` on a page that does not, and then this draws the plain reading
	 * surface it has always been: no chips, no right-click menu.
	 */
	const coding = useCodingSurface();

	/**
	 * The chip the reader is pointing at, so its words can light up in the turn.
	 *
	 * A span coding names a stretch of the message, and a chip on its own
	 * cannot say which -- the tooltip quotes the words, but finding them in the
	 * paragraph is then the reader's job. Held for the whole card rather than
	 * per turn because only one chip is ever under the pointer.
	 *
	 * The id rather than the coding, and resolved against the live codings
	 * below. Deleting a chip unmounts it, so its `mouseleave` never arrives and
	 * a held coding would go on lighting a stretch of text that nothing on
	 * screen is about any more.
	 */
	let pointedAt = $state<string | null>(null);

	/**
	 * The stretch to mark in this turn, in the offsets its bubble counts.
	 *
	 * The menu's pending span comes first: while it is open the reader is
	 * deciding what to code *that* stretch as, and it outranks whatever chip
	 * they happened to leave the pointer on.
	 */
	function litSpan(turn: EmbeddingTurn | TranscriptTurn): [number, number][] {
		const request = coding?.pending;
		if (request && request.messageId === turn.id && request.span) {
			return [[request.span.start, request.span.end]];
		}
		if (pointedAt === null) return [];
		const at = coding?.codingsFor(turn.id).find((candidate) => candidate.id === pointedAt);
		if (!at || !isSpan(at)) return [];
		return [[at.start_offset!, at.end_offset!]];
	}

	// Which turns are on screen, so the page can read their codings in one
	// request rather than one per turn. Effect rather than a call in the body:
	// a card is rebuilt whenever its chunk changes, and the ask must follow.
	$effect(() => {
		coding?.track(turnIds(turns));
	});

	// Both kinds carry the guide coordinates *and* the message id now — the id
	// moved onto the base turn so a card's turns can be coded too — so what
	// tells them apart is the transcript's own extras.
	function isTranscript(turn: EmbeddingTurn | TranscriptTurn): turn is TranscriptTurn {
		return 'skipped' in turn;
	}

	/**
	 * A right-click on a turn, with the words it landed on worked out.
	 *
	 * A selection only counts where the bubble renders the turn's text exactly
	 * — see `selectionWithin`. Everywhere else the whole turn is coded, which
	 * is the claim the reader can always be held to.
	 */
	function openMenu(event: MouseEvent, turn: EmbeddingTurn | TranscriptTurn) {
		if (!coding) return;
		event.preventDefault();
		const span = selectionWithin(event.currentTarget as HTMLElement, turn.text);
		coding.openMenu({
			messageId: turn.id,
			at: { x: event.clientX, y: event.clientY },
			span,
			quote: span ? turn.text.slice(span.start, span.end) : null
		});
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
	/**
	 * The rule each turn's question is subject to, by position in `turns`.
	 *
	 * Once per question group, on the first turn of it that is drawn. A gate
	 * belongs to the question and not to any one exchange inside it, so a group
	 * with three probes would otherwise print the same sentence four times down
	 * one card. Taking the first turn drawn rather than the main question means
	 * a Single Q&A card — which holds a probe and nothing above it — still says
	 * what its question depended on.
	 *
	 * Interviewer turns only: it is a fact about what was asked, and under the
	 * answer it would read as something the respondent was told.
	 */
	let notes = $derived.by(() => {
		// A plain record rather than a Set: this is scratch inside a derived,
		// rebuilt from nothing on every run, and nothing reads it as state.
		const seen: Record<string, true> = {};
		return turns.map((turn) => {
			if (turn.role === 'respondent') return null;
			if (turn.section === null || turn.section === undefined) return null;
			if (turn.main_question === null || turn.main_question === undefined) return null;
			const key = questionKey(turn.section, turn.main_question);
			if (seen[key]) return null;
			seen[key] = true;
			return conditions.get(key)?.text ?? null;
		});
	});
</script>

<div class="flex flex-col {compact ? 'gap-1.5' : ''}">
	{#each turns as turn, index (index)}
		{@const marks = coding?.codingsFor(turn.id) ?? []}
		<div role="group" oncontextmenu={(event) => openMenu(event, turn)}>
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
				coded={litSpan(turn)}
				condition={notes[index]}
				skipped={isTranscript(turn) ? (turn.skipped ?? false) : false}
				{compact}
			/>
			{#if marks.length > 0}
				<!-- Under the bubble and on the bubble's own side, so a turn's codes
				     read as belonging to it rather than to the one below. -->
				<div
					class="mt-1 flex flex-wrap items-center gap-1 {turn.role === 'respondent'
						? 'justify-end'
						: ''}"
				>
					<CodingChips
						codings={marks}
						codes={coding?.codes ?? []}
						content={turn.text}
						currentUserId={coding?.userId ?? ''}
						onRemove={(codingId) => coding?.uncode(turn.id, codingId)}
						onHover={(hovered) => (pointedAt = hovered?.id ?? null)}
					/>
				</div>
			{/if}
		</div>
	{/each}
</div>
