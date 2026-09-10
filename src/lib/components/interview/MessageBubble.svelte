<script lang="ts">
	import type { CustomToken } from '$lib/api';
	import { sanitizeMarkup, type MarkRange } from '$lib/utils/sanitize';
	import SurveyItem from './SurveyItem.svelte';
	import type { SurveyItemUnion } from './types';
	import type { Snippet } from 'svelte';

	/**
	 * One message, as a bubble, wherever a conversation is shown.
	 *
	 * There are three places a transcript is read — the live interview, the
	 * annotate page, and the explore view's cards and transcript dialog — and
	 * they were drifting apart: the explore side had grown its own bubble that
	 * escaped guide markup into visible tags, reduced a survey answer to a word,
	 * and dropped the question numbers. None of that was a decision; it was two
	 * renderings of one thing, changed one at a time.
	 *
	 * So this owns everything about how a message *looks* and nothing about
	 * where its data came from. The interview passes a live `Message`, the
	 * explore view passes a turn off the wire, and the differences that remain
	 * between them — density, and whether the keyword search is marked — are
	 * props rather than a second component.
	 *
	 * What stays outside: annotations, comments, feedback and skip. Those are
	 * affordances around a message rather than parts of one, and they belong to
	 * exactly one caller each. They come in through `controls`.
	 */

	/** Tokens the interviewer emits as control signals, shown as what they mean. */
	const TOKEN_CONFIG: Record<
		CustomToken,
		{ icon: string; label: string; color: string; justify: string }
	> = {
		'<|endofprobe|>': {
			icon: 'fa-solid fa-check',
			label: 'Probe complete',
			color: 'text-blue-600 bg-blue-50',
			justify: 'justify-center'
		},
		'<|endofsection|>': {
			icon: 'fa-solid fa-flag-checkered',
			label: 'Section complete',
			color: 'text-green-600 bg-green-50',
			justify: 'justify-center'
		},
		'<|endofinterview|>': {
			icon: 'fa-solid fa-circle-check',
			label: 'Interview complete',
			color: 'text-emerald-600 bg-emerald-50',
			justify: 'justify-center'
		},
		'<|skipquestion|>': {
			icon: 'fa-solid fa-forward',
			label: 'Question skipped',
			color: 'text-gray-600',
			justify: 'justify-end'
		},
		'<|skipsection|>': {
			icon: 'fa-solid fa-forward-fast',
			label: 'Section skipped',
			color: 'text-amber-600 bg-amber-50',
			justify: 'justify-center'
		},
		'<|noanswer|>': {
			icon: 'fa-solid fa-minus',
			label: 'No answer',
			color: 'text-gray-500 bg-gray-100',
			justify: 'justify-center'
		},
		'<|restartinterview|>': {
			icon: 'fa-solid fa-rotate',
			label: 'Interview restarted',
			color: 'text-purple-600 bg-purple-50',
			justify: 'justify-center'
		}
	};

	const TOKEN_PATTERN =
		/<\|(endofprobe|endofsection|endofinterview|skipquestion|skipsection|noanswer|restartinterview)\|>/;

	/** Written out, because Tailwind only sees class names it can read in the
	 *  source — an interpolated `justify-{...}` compiles to nothing. */
	const JUSTIFY: Record<string, string> = {
		'justify-center': 'justify-center',
		'justify-end': 'justify-end'
	};

	let {
		interviewer,
		text = '',
		label = null,
		image = null,
		surveyItem = null,
		surveyLabel = null,
		answer = '',
		matches = [],
		excluded = [],
		condition = null,
		skipped = false,
		compact = false,
		readonly = true,
		lang = 'EN',
		onSurveyAnswer,
		controls,
		media
	}: {
		/** Which side said it. The one thing every caller knows. */
		interviewer: boolean;
		text?: string;
		/** The guide number, `3.2`, when the message has a place in one. */
		label?: string | null;
		image?: { data: string; alt?: string } | null;
		/**
		 * The survey item in full, so the option set renders with the choice
		 * marked. An identical "Agree" from forty respondents is a click, and a
		 * reader can only judge it against the options it was chosen from.
		 */
		surveyItem?: SurveyItemUnion | null;
		/**
		 * The item's *type* alone, where the whole item is more than the caller
		 * has. A results card carries this rather than the full item: a mosaic of
		 * option sets would be a page of radio buttons, and the badge still says
		 * the answer was a click and not writing.
		 */
		surveyLabel?: string | null;
		/** What was chosen, for the survey item to show as selected. */
		answer?: string;
		/**
		 * Where the keyword query matched in `text`, as character offsets, and
		 * where a term it excluded turned up anyway. Both come from the server,
		 * which ran the query and so is the only side that knows what counted
		 * under the scope that was asked for.
		 */
		matches?: [number, number][];
		excluded?: [number, number][];
		/**
		 * The guide rule this question is subject to, in one line — see
		 * `$lib/analysis/conditions`.
		 *
		 * Worth carrying on a message rather than left to the guide because a
		 * conditional question reads exactly like an unconditional one once it
		 * is answered: the answers are a subset of the cohort chosen somewhere
		 * else, and nothing on screen says so. On a question the guide skipped
		 * it is the other half of the same sentence — the fade says something
		 * was skipped, this says why.
		 */
		condition?: string | null;
		skipped?: boolean;
		/**
		 * Sized for a results card rather than for a full-width chat column: no
		 * gutters, smaller type. The bubbles are otherwise the same ones, because
		 * a researcher reading a hit and reading the transcript is reading one
		 * conversation.
		 */
		compact?: boolean;
		/**
		 * Whether the survey item is a record or a control. Read-only everywhere a
		 * transcript is *read*; only the live interview passes false, and it is the
		 * only caller with anywhere to send an answer.
		 */
		readonly?: boolean;
		lang?: string;
		onSurveyAnswer?: (answer: unknown) => void;
		/** Feedback, skip — whatever this caller puts beside the bubble. */
		controls?: Snippet;
		/** Audio, or anything else that belongs inside the bubble under the text. */
		media?: Snippet;
	} = $props();

	/**
	 * Interviewer text is written by the project's collaborators in the guide and
	 * may contain markup — an outro linking to a support page. Respondent text is
	 * untrusted input and is rendered as text, never as markup.
	 */
	let allowMarkup = $derived(interviewer);

	/** A message that is nothing but a control token: a badge, not a bubble. */
	let standalone = $derived(TOKEN_CONFIG[text.trim() as CustomToken] ?? null);

	/**
	 * How the two kinds of mark look, in one place: the plain-text path renders
	 * them as elements and the markup path hands them to the sanitiser as
	 * strings, and a search hit must not look like two different things
	 * depending on whether the sentence around it happened to contain a link.
	 */
	const MARK_STYLE = {
		match: {
			className: 'rounded-sm bg-yellow-300/90 px-0.5 text-gray-900',
			title: 'Matched your search'
		},
		excluded: {
			className: 'rounded-sm bg-red-200/90 px-0.5 text-gray-900 line-through decoration-red-700/50',
			title: 'You excluded this word — it is here, but it is not why this chunk is in the results'
		}
	} as const;

	type Mark = 'match' | 'excluded' | null;

	type Piece =
		| { kind: 'token'; config: (typeof TOKEN_CONFIG)[CustomToken] }
		| { kind: 'html'; html: string }
		| { kind: 'text'; value: string; mark: Mark };

	/**
	 * The spans, merged and in order, as one list.
	 *
	 * The server guarantees matches and exclusions do not overlap each other, so
	 * sorting is all the merging this needs.
	 */
	let spans = $derived(
		[
			...matches.map(([start, end]) => ({ start, end, mark: 'match' as const })),
			...excluded.map(([start, end]) => ({ start, end, mark: 'excluded' as const }))
		].sort((a, b) => a.start - b.start)
	);

	/**
	 * A run of plain text, cut where the query matched inside it.
	 *
	 * `offset` is where the run starts in the whole message, because the spans
	 * index the message and not the run.
	 */
	function marked(value: string, offset: number): Piece[] {
		const inside = spans.filter(
			(span) => span.start >= offset && span.end <= offset + value.length
		);
		if (inside.length === 0) return [{ kind: 'text', value, mark: null }];

		const pieces: Piece[] = [];
		let last = 0;
		for (const span of inside) {
			const start = span.start - offset;
			const end = span.end - offset;
			if (start > last) pieces.push({ kind: 'text', value: value.slice(last, start), mark: null });
			pieces.push({ kind: 'text', value: value.slice(start, end), mark: span.mark });
			last = end;
		}
		if (last < value.length) pieces.push({ kind: 'text', value: value.slice(last), mark: null });
		return pieces;
	}

	/**
	 * The message body, split into what has to be rendered differently.
	 *
	 * Tokens first, so a badge stays a badge wherever it sits in a sentence, then
	 * the search marks inside each remaining run.
	 *
	 * A run that has to go through `{@html}` is still marked; the sanitiser does
	 * it, because the offsets index the source string and the source string is
	 * what the sanitiser walks. The alternative — mark around the result — is
	 * the one that cannot work, since the output is a different string.
	 *
	 * That the guide intro linking to a support page is also the message saying
	 * "stress" is not a coincidence, which is why giving up on marking it would
	 * have been a real loss rather than a theoretical one.
	 */
	let pieces = $derived.by((): Piece[] => {
		if (!text) return [];

		const out: Piece[] = [];
		let cursor = 0;
		for (const match of text.matchAll(new RegExp(TOKEN_PATTERN.source, 'g'))) {
			const config = TOKEN_CONFIG[match[0] as CustomToken];
			if (!config || match.index === undefined) continue;
			if (match.index > cursor) {
				out.push(...expand(text.slice(cursor, match.index), cursor));
			}
			out.push({ kind: 'token', config });
			cursor = match.index + match[0].length;
		}
		if (cursor < text.length) out.push(...expand(text.slice(cursor), cursor));
		return out;
	});

	function expand(value: string, offset: number): Piece[] {
		if (allowMarkup && /<[a-zA-Z][^>]*>/.test(value)) {
			// Marked *by* the sanitiser rather than around it. The offsets index
			// the source, which is exactly what the sanitiser walks, so it can
			// wrap a range as it escapes the run the range lands in — and a
			// "match" that turns out to be inside an `href` is dropped on the way,
			// which is the right answer: a keyword scan runs against the raw
			// message and will happily find a word in a URL that nobody said.
			return [
				{
					kind: 'html',
					html: sanitizeMarkup(
						value,
						spans.map((span): MarkRange => ({
							start: span.start,
							end: span.end,
							...MARK_STYLE[span.mark]
						}))
					)
				}
			];
		}
		return marked(value, offset);
	}

	/** A respondent's survey answer replaces the bubble rather than sitting in
	 *  one: the option set is its own card and looks wrong inside a second box. */
	let bare = $derived(!interviewer && surveyItem !== null);

	/**
	 * The survey badge, in indigo on whichever ground it lands on.
	 *
	 * Indigo is the guide editor's colour for a survey item, and it is the
	 * saturated one that actually reads as indigo — a wash of it against the
	 * green turns into a grey-blue nothing. So the dark ground gets the colour
	 * itself as the fill, which is small, unmistakably indigo, and darker than
	 * the pale chip that was competing with the answer above it. Light grounds
	 * keep the editor's own chip, since that is the card it was drawn for.
	 */
	let badgeTone = $derived(
		interviewer || bare
			? 'bg-indigo-50 text-indigo-600 ring-indigo-500/20'
			: 'ring-indigo-500 bg-indigo-500'
	);

	let gutter = $derived(compact ? '' : 'mb-[15px] px-[10px] sm:px-[50px]');
</script>

{#if standalone}
	<div class="flex w-full {JUSTIFY[standalone.justify]} {gutter} {skipped ? 'opacity-50' : ''}">
		<div
			class="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium {standalone.color}"
		>
			<i class={standalone.icon}></i>
			<span>{standalone.label}</span>
		</div>
	</div>
{:else}
	<div
		class="group relative flex w-full {gutter} {interviewer
			? 'items-start justify-start'
			: 'flex-col items-end justify-end'} {skipped ? 'opacity-50' : ''}"
	>
		<div
			class="relative inline-block rounded-xl break-words hyphens-auto
				{compact ? 'max-w-[90%] text-[0.8125rem]' : 'max-w-[90%] text-sm sm:max-w-[80%]'}
				{interviewer
				? `rounded-bl-sm bg-[#eee] text-gray-900 ${compact ? 'px-2.5 py-1.5' : 'p-2.5'}`
				: bare
					? ''
					: `rounded-br-sm bg-primary text-on-primary ${compact ? 'px-2.5 py-1.5' : 'p-2.5'}`}"
			{lang}
		>
			{#if label || (surveyLabel && !surveyItem)}
				<!-- One header line for everything that says what this message *is*,
				     rather than what it says: the guide number, and whether the
				     answer under it was a click. Both are labels on the same thing,
				     and stacking them cost a line of height on every survey bubble
				     for two items that fit side by side.

				     The badge is the item's type, where the item itself is not to
				     hand — the part a reader must not read as writing. Its poll icon
				     and indigo are the guide editor's, so a reader crossing from one
				     to the other recognises the thing rather than learning it twice;
				     which indigo depends on what it sits on, see `badgeTone`.

				     Pushed to the far edge rather than set beside the number: the
				     number is read down a column as the reader scans the guide
				     order, and a badge butted against it shifts with the digits —
				     `3.1` and `3.2.1` are different widths. `ml-auto` rather than
				     `justify-between` on the row, so it stays right on a bubble
				     with no number to sit opposite. -->
				<div class="mb-1 flex flex-wrap items-center gap-1.5">
					{#if label}
						<span class="text-xs font-bold opacity-60">{label}</span>
					{/if}
					{#if surveyLabel && !surveyItem}
						<span
							class="ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.625rem] font-medium tracking-wide uppercase ring-1 {badgeTone}"
						>
							<i class="fa-solid fa-square-poll-horizontal text-[0.6875rem]"></i>
							{surveyLabel}
						</span>
					{/if}
				</div>
			{/if}
			{#if image}
				<img
					src={image.data}
					alt={image.alt || 'Image'}
					class="max-h-[350px] max-w-full rounded-[5px] sm:max-h-[40vh]"
				/>
			{/if}
			{@render media?.()}
			{#if pieces.length}
				<!-- Tailwind's preflight strips link styling, and sanitised markup is
				     outside the reach of scoped CSS, so style anchors from here. -->
				<span
					class="whitespace-pre-wrap [&_a]:font-medium [&_a]:underline [&_a]:underline-offset-2"
				>
					{#each pieces as piece, index (index)}{#if piece.kind === 'token'}<span
								class="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium {piece
									.config.color}"
							>
								<i class={piece.config.icon}></i>
								{piece.config.label}
							</span>{:else if piece.kind === 'html'}
							<!-- Guide markup, marks and all, as one sanitised string — see
							     `expand` above. Formatted loosely, the way this branch has
							     always been written on the transcript page: Svelte trims
							     whitespace at a block boundary, so the newlines do not become
							     spaces in the sentence. -->
							<!-- eslint-disable-next-line svelte/no-at-html-tags -->
							{@html piece.html}
						{:else if piece.mark}<mark
								class={MARK_STYLE[piece.mark].className}
								title={MARK_STYLE[piece.mark].title}>{piece.value}</mark
							>{:else}{piece.value}{/if}{/each}
				</span>
			{/if}
			{#if surveyItem}
				<div class="whitespace-normal">
					<SurveyItem
						{...surveyItem}
						{lang}
						{readonly}
						{answer}
						onAnswer={(given: unknown) => onSurveyAnswer?.(given)}
					/>
				</div>
			{/if}
			{#if condition}
				<!-- Under the question rather than beside it: it is a footnote on
				     what was asked, and amber with a branch icon because that is
				     what a condition looks like in the guide editor and on the
				     report page. Inside the bubble so a faded, skipped question
				     carries its own explanation rather than leaving a bright line
				     under a grey box. -->
				<div
					class="mt-1.5 flex items-start gap-1.5 border-t border-black/5 pt-1.5 text-[0.6875rem] whitespace-normal text-amber-700"
				>
					<i class="fa-solid fa-code-branch mt-0.5 shrink-0 text-[0.625rem] text-amber-500"></i>
					<span class="min-w-0">{condition}</span>
				</div>
			{/if}
		</div>

		{@render controls?.()}
	</div>
{/if}
