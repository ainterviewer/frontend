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
