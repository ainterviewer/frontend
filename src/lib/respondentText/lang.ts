// The languages respondent-facing text is written in by hand.
//
// A project can run in any language the backend lists, but the fixed text
// around its own content -- buttons, the welcome screen's notice, survey
// controls -- exists only in these. Any other language gets English.

export const LANGS = ['EN', 'DA', 'DE', 'ES', 'FR', 'AR', 'SW'] as const;

export type Lang = (typeof LANGS)[number];

/**
 * The language to show fixed text in for a project language code.
 *
 * Codes reach the interview uppercased from the backend, and the dashboard
 * lowercased from its URL; both resolve here. Unknown or missing codes get
 * English.
 */
export function toLang(code: string | null | undefined): Lang {
	const upper = code?.toUpperCase();
	return (LANGS as readonly string[]).includes(upper ?? '') ? (upper as Lang) : 'EN';
}

// Languages written right to left, of those the backend lists. Kurdish and
// Kashmiri are left out: each is written in a Latin or Devanagari script as
// often as an Arabic one, and the code alone does not say which.
const RTL_CODES = new Set(['AR', 'DV', 'FA', 'HE', 'PS', 'SD', 'UG', 'UR', 'YI']);

/**
 * The direction a project language is written in. Unlike `toLang`, this goes
 * by the project's own language, not the fixed text's: a Persian project gets
 * English buttons, but its guide is still Persian and reads right to left.
 */
export function textDir(code: string | null | undefined): 'ltr' | 'rtl' {
	return RTL_CODES.has(code?.toUpperCase() ?? '') ? 'rtl' : 'ltr';
}
