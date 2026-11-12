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
}

export function likertLayout(options: readonly string[]): LikertLayout {
	const parsed = options.map((option) => {
		const numbered = NUMBERED.exec(option);
		if (numbered) return { tick: numbered[1], text: numbered[2] };
		const bare = NUMBER_ONLY.exec(option);
		if (bare) return { tick: bare[1], text: null };
		return null;
	});

	const indices = parsed.flatMap((p, i) => (p?.text ? [i] : []));
	if (parsed.some((p) => p === null) || indices.length === 0) {
		return { ticks: [...options], anchors: [] };
	}

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

	return { ticks: parsed.map((p) => p!.tick), anchors };
}
