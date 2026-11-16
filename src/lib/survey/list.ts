/**
 * A list item's answer: a JSON array of the respondent's entries, in the order
 * given, trimmed and blanks left out. Mirrors the library's
 * `ListItem.encode_answer` / `parse_answer` / `describe_answer`, which the
 * server reads it back with.
 */

type Bounds = {
	min_entries?: number | null;
	max_entries?: number | null;
	required?: boolean | null;
};

export function encodeListAnswer(entries: string[]): string {
	return JSON.stringify(entries.map((entry) => entry.trim()).filter(Boolean));
}

/** The entries of a stored answer; anything else reads as no entries. */
export function parseListAnswer(answer: string): string[] {
	let data: unknown;
	try {
		data = JSON.parse(answer);
	} catch {
		return [];
	}
	if (!Array.isArray(data)) return [];
	return data.filter((entry): entry is string => typeof entry === 'string');
}

/** The answer as "- entry" lines; text that is not a list answer is returned as is. */
export function describeListAnswer(answer: string): string {
	const entries = parseListAnswer(answer);
	return entries.length ? entries.map((entry) => `- ${entry}`).join('\n') : answer;
}

/** A list whose bounds are equal asks for exactly that many entries. */
export function fixedEntries({ min_entries, max_entries }: Bounds): number | null {
	return min_entries != null && min_entries === max_entries ? min_entries : null;
}

/**
 * The fewest entries the respondent submits. The library's `ListItem.fewest`,
 * except never below one: an optional list is left out with the skip button,
 * and an empty answer is nothing to send.
 */
export function fewestEntries({ min_entries, required }: Bounds): number {
	return Math.max(min_entries ?? (required === false ? 0 : 1), 1);
}

/** What a list asks for, in words: "exactly 3 entries", "2–5 entries". */
export function describeListBounds({ min_entries: min, max_entries: max }: Bounds): string {
	if (min != null && min === max) return `exactly ${min} ${min === 1 ? 'entry' : 'entries'}`;
	if (min != null && max != null) return `${min}–${max} entries`;
	if (max != null) return `up to ${max} ${max === 1 ? 'entry' : 'entries'}`;
	if (min != null) return `at least ${min} ${min === 1 ? 'entry' : 'entries'}`;
	return 'any number of entries';
}

/** The fields the list starts with: as many as it needs, at least one. */
export function initialEntries(bounds: Bounds): number {
	const start = fixedEntries(bounds) ?? fewestEntries(bounds);
	return bounds.max_entries != null ? Math.min(start, bounds.max_entries) : start;
}
