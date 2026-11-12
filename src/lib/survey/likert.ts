/**
 * How a likert scale's option labels are laid out across its columns.
 *
 * A numbered scale is often written with words only on its ends: "1. Not at
 * all worried", "2", …, "10. Very worried". Each option gets an equal column,
 * so on a ten-point scale the words were squeezed into one narrow column and
 * broke into syllables. Here the number stays under its radio and the words
 * move to a row of their own under the scale (an *anchor*), where they may
 * span the columns of the plain-number options next to them.
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
	/** What goes under each radio: the number in an anchored layout, else the option. */
	ticks: string[];
	/** Empty when the scale is not a numbered one, and every label sits in its column. */
	anchors: LikertAnchor[];
	/** Every option is a number, worded or not: the columns hold only numbers. */
	numbered: boolean;
}

export function likertLayout(options: readonly string[]): LikertLayout {
	const parsed = options.map((option) => {
		const numbered = NUMBERED.exec(option);
		if (numbered) return { tick: numbered[1], text: numbered[2] };
		const bare = NUMBER_ONLY.exec(option);
		if (bare) return { tick: bare[1], text: null };
		return null;
	});

	if (parsed.some((p) => p === null)) {
		return { ticks: [...options], anchors: [], numbered: false };
	}
	const ticks = parsed.map((p) => p!.tick);
	const indices = parsed.flatMap((p, i) => (p!.text ? [i] : []));
	if (indices.length === 0) return { ticks, anchors: [], numbered: true };

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
		const text = parsed[i]!.text!;
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

	return { ticks, anchors, numbered: true };
}

/** Rough width of a character of a label (0.75rem, medium) and of the parts around it. */
const CHAR_PX = 6.5;
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

/**
 * About the narrowest the scale can be laid out in columns without breaking
 * a word. The columns are equal, as a scale's points should be, so all are as
 * wide as the longest word on the scale needs.
 *
 * An estimate from character counts rather than a measurement, so it is the
 * same on the server as in the browser and the layout never changes after
 * the page appears.
 */
export function likertMinWidth(layout: LikertLayout): number {
	const column = layout.numbered
		? NUMBER_COLUMN_PX
		: Math.max(
				0,
				...layout.ticks.flatMap(labelWords).map((word) => word.length * CHAR_PX + LABEL_PADDING_PX)
			);
	const n = layout.ticks.length;
	return n * column + Math.max(0, n - 1) * GAP_PX + FIELDSET_PADDING_PX;
}
