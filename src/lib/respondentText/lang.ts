// The languages respondent-facing text is written in by hand.
//
// A project can run in any language the backend lists, but the fixed text
// around its own content -- buttons, the welcome screen's notice, survey
// controls -- exists only in these. Any other language gets English.

export const LANGS = ['EN', 'DA', 'DE', 'ES', 'FR'] as const;

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
