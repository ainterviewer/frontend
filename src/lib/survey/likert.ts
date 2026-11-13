/**
 * How a likert scale's option labels are laid out across its columns.
 *
 * A scale is often written with words only on some points: "1. Not at all
 * worried", "2", …, "10. Very worried", or "Disagree", "", "", "Agree".
 * Each option gets an equal column, so on a ten-point scale the words were
 * squeezed into one narrow column and broke into syllables. Here each column
 * holds only the point's number, if it has one, and the words move to a row
 * of their own under the scale (an *anchor*), where they may span the
 * columns of the unlabelled points next to them.
 *
 * The answer is still the option's full text; only the display is split.
 */

/** "1. Text", "1) Text", "1: Text", "1 = Text", "1 - Text" or "1 Text". */
const NUMBERED = /^\s*(-?\d+)\s*(?:[.):=]|[-–—])?\s+(\S.*?)\s*$/;
const NUMBER_ONLY = /^\s*(-?\d+)\s*[.):]?\s*$/;

export interface LikertAnchor {
	/** Index of the option the words belong to. */
	index: number;
	text: string;
	/** First and last column the anchor may use, inclusive, 0-based. */
	from: number;
	to: number;
	align: 'left' | 'center' | 'right';
}

export interface LikertLayout {
	/** What goes under each radio: its number, or nothing, in an anchored layout; else the option. */
	ticks: string[];
	/** Empty when every label sits in its column. */
	anchors: LikertAnchor[];
	/**
	 * The columns hold at most a number each, so they can be narrow: every
	 * option is numbered, or some point has no words and the words are
	 * anchors.
	 */
	narrow: boolean;
}

export function likertLayout(options: readonly string[]): LikertLayout {
	// The number under the radio ('' for none), and the words, if any.
	const parsed = options.map((option) => {
		const numbered = NUMBERED.exec(option);
		if (numbered) return { tick: numbered[1], text: numbered[2], number: true };
		const bare = NUMBER_ONLY.exec(option);
		if (bare) return { tick: bare[1], text: null, number: true };
		const text = option.trim();
		return { tick: '', text: text || null, number: !text };
	});

	// Anchored where every point is numbered, or where some point is left
	// without words (a bare number or nothing): then the worded points are
	// the scale's landmarks. A scale with words on every point keeps them in
	// their columns.
	const anchored = parsed.every((p) => p.number) || parsed.some((p) => p.text === null);
	if (!anchored) return { ticks: [...options], anchors: [], narrow: false };

	const ticks = parsed.map((p) => p.tick);
	const indices = parsed.flatMap((p, i) => (p.text ? [i] : []));
	if (indices.length === 0) return { ticks, anchors: [], narrow: true };

	const n = options.length;
	const last = n - 1;
	const alignOf = (i: number) => (i === 0 ? 'left' : i === last ? 'right' : 'center');

	// A centred anchor takes the same number of columns on either side of its
	// own, sharing each gap to a neighbouring anchor evenly. An anchor on an
	// end runs from the edge up to whatever its neighbour leaves free.
	const half = indices.map((i, k) => {
		if (alignOf(i) !== 'center') return 0;
		const left = k > 0 ? Math.floor((i - indices[k - 1] - 1) / 2) : i;
		const right = k < indices.length - 1 ? Math.floor((indices[k + 1] - i - 1) / 2) : last - i;
		return Math.min(left, right);
	});

	const anchors = indices.map((i, k): LikertAnchor => {
		const align = alignOf(i);
		const text = parsed[i].text!;
		if (align === 'center') return { index: i, text, from: i - half[k], to: i + half[k], align };

		const neighbour = align === 'left' ? k + 1 : k - 1;
		const j = indices[neighbour];
		if (j === undefined) {
			return { index: i, text, from: 0, to: last, align };
		}
		if (alignOf(j) === 'center') {
			return align === 'left'
				? { index: i, text, from: 0, to: j - half[neighbour] - 1, align }
				: { index: i, text, from: j + half[neighbour] + 1, to: last, align };
		}
		// Both ends anchored and nothing between: split down the middle, the
		// odd column going to the left.
		const split = Math.ceil(n / 2);
		return align === 'left'
			? { index: i, text, from: 0, to: split - 1, align }
			: { index: i, text, from: split, to: last, align };
	});

	return { ticks, anchors, narrow: true };
}

/**
 * Width of each character of a label, in em, of medium Inter (the app's
 * font, measured in the browser). Letters with a diacritic are measured as
 * their base letter; anything not here as an average letter.
 */
const CHAR_EM: Record<string, number> = {
	...widths('fijlI!.,', [0.34, 0.25, 0.25, 0.25, 0.27, 0.3, 0.3, 0.3]),
	...widths('rt/()1-', [0.4, 0.34, 0.37, 0.37, 0.37, 0.42, 0.46]),
	...widths(
		'abcdeghknopqsuvxyz?',
		[
			0.57, 0.62, 0.58, 0.62, 0.59, 0.62, 0.6, 0.56, 0.6, 0.6, 0.62, 0.62, 0.54, 0.6, 0.57, 0.56,
			0.58, 0.56, 0.53
		]
	),
	...widths('mwæ', [0.89, 0.83, 0.92]),
	...widths(
		'ABCDEFGHJKLNOPQRSTUVXYZØ',
		[
			0.72, 0.66, 0.73, 0.72, 0.6, 0.59, 0.75, 0.74, 0.58, 0.69, 0.57, 0.76, 0.77, 0.64, 0.77, 0.65,
			0.65, 0.65, 0.74, 0.72, 0.7, 0.7, 0.64, 0.77
		]
	),
	...widths('MWÆ', [0.91, 1.02, 1]),
	...widths('023456789', [0.65, 0.62, 0.63, 0.66, 0.6, 0.63, 0.59, 0.63, 0.63])
};
const AVERAGE_EM = 0.6;
const LABEL_FONT_PX = 12; // `text-xs`

function widths(chars: string, em: number[]): Record<string, number> {
	return Object.fromEntries([...chars].map((char, i) => [char, em[i]]));
}

/** About how wide `word` renders in a label of `fontPx`. */
function wordPx(word: string, fontPx = LABEL_FONT_PX): number {
	let em = 0;
	for (const char of word) {
		em += CHAR_EM[char] ?? CHAR_EM[char.normalize('NFD')[0]] ?? AVERAGE_EM;
	}
	return em * fontPx;
}

const NUMBER_COLUMN_PX = 28; // `w-7`
const LABEL_PADDING_PX = 8; // `px-1`
const GAP_PX = 4; // `gap-x-1`
const FIELDSET_PADDING_PX = 32; // `p-4`

/**
 * A label's words as the browser may wrap them: at spaces, and after a slash
 * ("Hverken/eller"), which the item marks with a `<wbr>` since browsers do
 * not break there on their own.
 */
export function labelWords(label: string): string[] {
	return label.split(/\s+|(?<=\/)/).filter(Boolean);
}

/** About how wide `text`'s longest word is, without padding. */
function longestWordPx(text: string, fontPx = LABEL_FONT_PX): number {
	return Math.max(0, ...labelWords(text).map((word) => wordPx(word, fontPx)));
}

/**
 * How wide each of a scale's narrow columns must be: room for a radio, and
 * for each anchor's longest word across the columns it spans and the gaps
 * between them.
 */
function narrowColumnPx(layout: LikertLayout, gapPx: number, fontPx = LABEL_FONT_PX): number {
	return Math.max(
		NUMBER_COLUMN_PX,
		...layout.anchors.map((anchor) => {
			const span = anchor.to - anchor.from + 1;
			return (longestWordPx(anchor.text, fontPx) - (span - 1) * gapPx) / span;
		})
	);
}

/**
 * About the narrowest the scale can be laid out in columns without breaking
 * a word. The columns are equal, as a scale's points should be, so all are as
 * wide as the most demanding label needs: a label in its column, or an
 * anchor across the columns it may span.
 *
 * An estimate from character counts rather than a measurement, so it is the
 * same on the server as in the browser and the layout never changes after
 * the page appears.
 */
export function likertMinWidth(layout: LikertLayout): number {
	const column = layout.narrow
		? narrowColumnPx(layout, GAP_PX)
		: Math.max(0, ...layout.ticks.map((label) => longestWordPx(label) + LABEL_PADDING_PX));
	const n = layout.ticks.length;
	return n * column + Math.max(0, n - 1) * GAP_PX + FIELDSET_PADDING_PX;
}

/**
 * How wide the respondent's answer bubble gets: on a phone, on a computer in
 * a window just over `sm`, and from `md` up.
 */
export const BUBBLE_PX = { phone: 300, narrow: 380, wide: 480 } as const;

/**
 * Below which breakpoint a layout no longer fits and gives way to a more
 * compact one: `never`, below `sm` (phones), below `md`, or `always`.
 */
export type GivesWay = 'never' | 'sm' | 'md' | 'always';

/**
 * Where a layout needing `minWidth` gives way. `onPhones` gives way on a
 * phone whatever the width, for a layout that does not suit one at all.
 * With `phone`, the editor's phone preview, the answer is for a phone only:
 * `always` or `never`.
 */
export function givesWay(minWidth: number, onPhones = false, phone = false): GivesWay {
	const below: GivesWay =
		minWidth > BUBBLE_PX.wide
			? 'always'
			: minWidth > BUBBLE_PX.narrow
				? 'md'
				: minWidth > BUBBLE_PX.phone || onPhones
					? 'sm'
					: 'never';
	if (phone) return below === 'never' ? 'never' : 'always';
	return below;
}

/** How wide each of a Likert grid table's point columns must be for its heading. */
function gridTableColumnPx(options: readonly string[]): number {
	return Math.max(
		NUMBER_COLUMN_PX,
		...options.flatMap(labelWords).map((word) => wordPx(word) + LABEL_PADDING_PX)
	);
}

/**
 * The share of a Likert grid's table its statements get (`SurveyGrid`):
 * what the scale's points leave over in a computer's narrower bubble, so
 * that the table still fits wherever it did before, from 30% for a
 * scale that needs the room to half for a short one, whose few columns
 * would otherwise stand half empty beside statements squeezed onto several
 * lines.
 */
export function gridStatementShare(options: readonly string[]): number {
	const points = options.length * gridTableColumnPx(options);
	const share = 1 - points / (BUBBLE_PX.narrow - FIELDSET_PADDING_PX);
	return Math.min(0.5, Math.max(0.3, Math.floor(share * 20) / 20));
}

/**
 * The narrowest a Likert grid's table can be with every heading word whole:
 * the statements take their share (`gridStatementShare`), the scale's points
 * split the rest evenly, and a point needs room for its radio at least.
 */
export function gridTableMinWidth(options: readonly string[]): number {
	const share = gridStatementShare(options);
	return (options.length * gridTableColumnPx(options)) / (1 - share) + FIELDSET_PADDING_PX;
}

/**
 * Words this long may hyphenate in a compact column, the scale on a phone:
 * `[hyphenate-limit-chars:7_3_3]`.
 */
const COMPACT_HYPHENATE_CHARS = 7;
const COMPACT_FONT_PX = 11; // `text-[0.6875rem]`
const COMPACT_PADDING_PX = 4; // `px-0.5`
const CARD_FRAME_PX = 16 + 24; // the card's `px-2` and the grid's `p-3`

/**
 * About how wide a word must be to sit in a compact column: whole, or for a
 * long one, the longer half of it once hyphenated ("Hver-" "ken"). Where it
 * really breaks is the browser's dictionary's call; halfway is the fair
 * guess.
 */
function compactWordPx(word: string): number {
	if (word.length < COMPACT_HYPHENATE_CHARS) return wordPx(word, COMPACT_FONT_PX);
	const half = Math.ceil(word.length / 2);
	return Math.max(
		wordPx(`${word.slice(0, half)}-`, COMPACT_FONT_PX),
		wordPx(word.slice(half), COMPACT_FONT_PX)
	);
}

/**
 * How wide each of a row of compact columns must be for `labels`. Small
 * text, and a long word may hyphenate: a respondent on a phone would rather
 * read "Hver-ken" than scroll through a scale of six turned into rows.
 */
function compactColumnPx(labels: readonly string[]): number {
	return Math.max(
		NUMBER_COLUMN_PX,
		...labels.flatMap(labelWords).map((word) => compactWordPx(word) + COMPACT_PADDING_PX)
	);
}

/**
 * The narrowest a single Likert item's scale can be in compact columns, the
 * step between whole-word columns (`likertMinWidth`) and rows. A numbered
 * scale's columns are narrow already, so it has no compact step.
 */
export function likertCompactMinWidth(layout: LikertLayout): number {
	if (layout.narrow) return likertMinWidth(layout);
	return layout.ticks.length * compactColumnPx(layout.ticks) + FIELDSET_PADDING_PX;
}

/**
 * The narrowest a grid card can hold the scale's points side by side: in
 * compact columns, or for a scale with anchors (`likertLayout`), narrow
 * ones with the anchors under them. The card's columns have no gaps. Only
 * a scale that does not fit even so stacks.
 */
export function gridCardMinWidth(options: readonly string[]): number {
	const layout = likertLayout(options);
	const column = layout.narrow
		? narrowColumnPx(layout, 0, COMPACT_FONT_PX)
		: compactColumnPx(options);
	return options.length * column + CARD_FRAME_PX;
}

const SLIDER_FRAME_PX = 32 + 16; // the fieldset's `p-4` and the track's `px-2`

/**
 * The narrowest a slider's labels can sit one under each point with their
 * words whole: equal columns, as the points are evenly spaced.
 */
export function sliderLabelsMinWidth(labels: readonly string[]): number {
	const column = Math.max(0, ...labels.map((label) => longestWordPx(label) + 4));
	return labels.length * column + Math.max(0, labels.length - 1) * GAP_PX + SLIDER_FRAME_PX;
}
