import type { TemplatePlaceholder } from '$lib/api/types.gen';

// Keyed by the backend's TemplatePlaceholder enum, which is the authoritative
// list (app/services/email/participant_template.py, exported through the
// OpenAPI schema). Record<> demands an entry per member, so adding a
// placeholder in the backend breaks this build until it is given a label
// here, rather than silently never being offered to template authors.
export const PLACEHOLDER_LABELS: Record<TemplatePlaceholder, string> = {
	name: 'Name',
	email: 'Email',
	pid: 'PID',
	interview_url: 'Interview URL',
	project_title: 'Project title',
	opt_out_url: 'Opt-out URL'
};

export const PLACEHOLDER_KEYS = Object.keys(PLACEHOLDER_LABELS) as TemplatePlaceholder[];

export const placeholders = PLACEHOLDER_KEYS.map((key) => ({
	key,
	label: PLACEHOLDER_LABELS[key]
}));

// Placeholders that name a personal link, and so belong in an href rather than
// in the text flow.
export const URL_PLACEHOLDER_KEYS = PLACEHOLDER_KEYS.filter((key) => key.endsWith('_url'));

export function isUrlPlaceholder(key: string): key is TemplatePlaceholder {
	return (URL_PLACEHOLDER_KEYS as string[]).includes(key);
}

/** Shown in place of an editable URL once a personal link is chosen. */
export const URL_PLACEHOLDER_HINTS: Record<string, string> = {
	interview_url: "Each participant's personal interview link",
	opt_out_url: "Each participant's personal opt-out link"
};

/** Built from the same keys so nothing can fall behind the label list. */
export function placeholderPattern(flags = 'g') {
	return new RegExp(`\\{\\{\\s*(${PLACEHOLDER_KEYS.join('|')})\\s*\\}\\}`, flags);
}

export function placeholderText(key: TemplatePlaceholder | string) {
	return `{{ ${key} }}`;
}

/**
 * Apply `fn` to the text between tags only. Placeholders live both in the text
 * flow and inside `href` attributes; rewriting the latter would corrupt the
 * markup, so attribute values are left strictly alone.
 */
function mapTextSegments(html: string, fn: (text: string) => string) {
	return html.replace(/<[^>]*>|[^<]+/g, (segment) =>
		segment.startsWith('<') ? segment : fn(segment)
	);
}

/**
 * Turn literal `{{ key }}` text into the markup the placeholder node parses.
 * Stored templates keep the literal form -- this runs only on the way into the
 * editor, and `getHTML()` renders the node straight back to literal text.
 */
export function placeholdersToNodes(html: string) {
	return mapTextSegments(html, (text) =>
		text.replace(placeholderPattern(), (_, key) => `<span data-placeholder="${key}"></span>`)
	);
}

/**
 * The inverse of {@link placeholdersToNodes}: collapse the editor's placeholder
 * spans back to the literal text that gets saved and sent.
 */
export function nodesToPlaceholders(html: string) {
	return html.replace(/<span[^>]*\sdata-placeholder="([^"]*)"[^>]*><\/span>/g, (_, key) =>
		placeholderText(key)
	);
}
