/**
 * A Likert grid's answer: a JSON object from row id to the chosen option, in
 * row order, a row left blank absent from it. Mirrors the library's
 * `LikertGridItem.encode_answer` / `parse_answer` / `describe_answer`, which
 * the server reads it back with.
 */

type Row = { id?: string | null; text: string };

export function encodeGridAnswer(values: Record<string, string>, rows: Row[]): string {
	const answer: Record<string, string> = {};
	for (const row of rows) {
		const value = row.id ? values[row.id] : undefined;
		if (row.id && value) answer[row.id] = value;
	}
	return JSON.stringify(answer);
}

/** Row id -> chosen option, for the rows that exist; anything else reads as no ratings. */
export function parseGridAnswer(answer: string, rows: Row[]): Record<string, string> {
	let data: unknown;
	try {
		data = JSON.parse(answer);
	} catch {
		return {};
	}
	if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
	const ids = new Set(rows.map((row) => row.id).filter(Boolean));
	return Object.fromEntries(
		Object.entries(data as Record<string, unknown>).filter(
			(entry): entry is [string, string] => ids.has(entry[0]) && typeof entry[1] === 'string'
		)
	);
}

/** The answer as "row: option" lines; text that is not a grid answer is returned as is. */
export function describeGridAnswer(answer: string, rows: Row[]): string {
	const values = parseGridAnswer(answer, rows);
	const lines = rows
		.filter((row) => row.id && values[row.id])
		.map((row) => `${row.text}: ${values[row.id!]}`);
	return lines.length ? lines.join('\n') : answer;
}
