/**
 * Colours shared by the dashboard's charts.
 *
 * They live together because the dashboard is read as one surface: a reader
 * who learns "green is the first language" on the monitoring page carries that
 * to the analysis page. Two scales that mean different things must not be able
 * to drift onto the same hues, which is exactly what happens when each page
 * keeps its own list.
 */

/**
 * Categorical hues for a language breakdown, validated for colour-vision
 * deficiency across every pair (not just neighbouring segments, since a legend
 * invites comparing any two). The lead hue is the brand green, which is the one
 * slot slightly under the chroma floor; the two lightest hues sit under 3:1
 * against white, which always-visible legend labels relieve.
 */
export const LANGUAGE_COLORS = ['#00705f', '#cf9426', '#4276db', '#cd5f8c', '#59c0d8'];

/** Languages past the palette are folded into one neutral slice. */
export const OTHER_LANGUAGE_COLOR = '#94a3b8';

/**
 * How far an answer got. Deliberately *not* drawn from `LANGUAGE_COLORS`: both
 * scales appear on the same analysis page, and an amber "skipped" bar beside an
 * amber "Danish" segment reads as one thing when it is two.
 *
 * This is a completeness scale rather than a categorical one, so it runs dark
 * to light, with the one state worth acting on picked out in red.
 */
export const ANSWER_STATE_COLORS = {
	answered: '#475569',
	skipped: '#94a3b8',
	dropped: '#dc2626'
};

/** A value that is not one of an item's authored options. */
export const WRITE_IN_COLOR = '#94a3b8';

/**
 * The colour for a language, fixed by its position in the project's full list
 * so filtering the cohort down never recolours the languages left on screen.
 */
export function languageColor(language: string, allLanguages: readonly string[]): string {
	const index = allLanguages.indexOf(language);
	if (index < 0 || index >= LANGUAGE_COLORS.length) return OTHER_LANGUAGE_COLOR;
	return LANGUAGE_COLORS[index];
}

/**
 * The colour of a series that is *not* split by language: one language in the
 * cohort, or the split turned off.
 *
 * A single language keeps its own hue, so turning the split off in a
 * one-language project changes nothing. Pooling several falls back to the lead
 * hue, because a pooled bar is one series and must not read as any one
 * language's.
 */
export function pooledColor(
	languages: readonly string[],
	colorFor: (language: string) => string
): string {
	return languages.length === 1 ? colorFor(languages[0]) : LANGUAGE_COLORS[0];
}

/**
 * Hues for HDBSCAN cluster ids on the analysis explore map.
 *
 * A cluster id is a label with no order and no meaning of its own — id 3 is not
 * "more" than id 2 — so this is a categorical scale, cycled once a run finds
 * more clusters than there are hues. Kept apart from `LANGUAGE_COLORS` because
 * the two never share a surface: the map is the only place clusters are drawn,
 * and borrowing the language hues there would teach the brand green a second
 * meaning on the one page where its first meaning is absent.
 *
 * Ten hues rather than five, because `min_cluster_size` is a slider the reader
 * drags: pulled low enough it routinely finds a dozen clusters. Cycling is the
 * honest failure — the map runs out of distinguishable colour long before it
 * runs out of clusters — and the panel beside it names every cluster in text.
 */
export const CLUSTER_COLORS = [
	'#3b6fd4',
	'#d1620f',
	'#1f8a70',
	'#b3459a',
	'#7a5cd0',
	'#9c6b1f',
	'#c0392b',
	'#4f8f2a',
	'#0f7f9c',
	'#8b6f5e'
];

/**
 * A point HDBSCAN declined to place. Deliberately a grey rather than an
 * eleventh hue: outliers are drawn rather than dropped — in interview data the
 * answer that fits nowhere is frequently the interesting one — but they are not
 * a cluster, and a coloured one would read as one.
 */
export const OUTLIER_COLOR = '#94a3b8';

/**
 * The colour for the nth group drawn on the explore map, or the outlier grey
 * for a point in no group at all.
 *
 * Takes a position rather than an identity because the map is coloured by
 * whichever grouping the reader has chosen — HDBSCAN's clusters, or the
 * interview guide's questions and sections — and only the clusters arrive as
 * small integers. Everything else is keyed by guide coordinates and gets its
 * hue from its place in the ordered legend beside the map.
 */
export function mapColor(index: number | null): string {
	if (index === null || index < 0) return OUTLIER_COLOR;
	return CLUSTER_COLORS[index % CLUSTER_COLORS.length];
}

/**
 * The points of an ordered answer scale -- a Likert grid's columns -- light to
 * dark in one hue.
 *
 * Sequential rather than diverging: the guide does not say which end of a
 * scale is the good one ("Strongly agree" comes first as often as last), and
 * two opposed hues would claim a polarity the data does not carry. Violet,
 * because it is the one hue family `LANGUAGE_COLORS` and the answer states
 * leave free, so a scale segment never reads as a language. Lightness rises
 * monotonically; the lightest steps sit under 3:1 against white, so every
 * segment is labelled (legend, and its share where it fits).
 */
export const SCALE_RAMP = ['#d6ccf7', '#b9a7ef', '#9c84e3', '#8064d2', '#6648b8', '#4b3292'];

/** `n` colours spread evenly over `SCALE_RAMP`, first point lightest. */
export function scaleColors(n: number): string[] {
	if (n <= 0) return [];
	if (n === 1) return [SCALE_RAMP[3]];
	const last = SCALE_RAMP.length - 1;
	return Array.from({ length: n }, (_, i) => SCALE_RAMP[Math.round((i * last) / (n - 1))]);
}

/** Whether text on a `SCALE_RAMP` colour should be light. */
export function isDarkScaleColor(color: string): boolean {
	return SCALE_RAMP.indexOf(color) >= 3;
}
