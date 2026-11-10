/**
 * Reading a checkbox answer back into the options it chose.
 *
 * A checkbox selection is submitted as one answer, its values joined with
 * `CHECKBOX_SEPARATOR`. An option may itself hold a comma ("Yes, often"), so
 * the answer is not split blindly. Mirrors `split_checkbox_answer` in the
 * `ainterviewer` library, which the backend reads answers with; keep the two
 * in step.
 */

export const CHECKBOX_SEPARATOR = ', ';

const normalize = (value: string) => value.split(/\s+/).filter(Boolean).join(' ').toLowerCase();

/**
 * The values in `answer`: runs of comma-separated parts that spell one of
 * `options` are kept whole, the longest run first. Parts that spell none are
 * what was typed into "Other", commas and all, and come back as one value,
 * last.
 */
export function splitCheckboxAnswer(answer: string, options: readonly string[]): string[] {
	const parts = answer.split(',');
	const known = new Set(options.map(normalize));
	const longest = Math.max(0, ...options.map((option) => option.split(',').length - 1)) + 1;

	const values: string[] = [];
	const other: string[] = [];
	let start = 0;
	while (start < parts.length) {
		let matched = false;
		for (let end = Math.min(parts.length, start + longest); end > start; end--) {
			const candidate = parts.slice(start, end).join(',').trim();
			if (candidate && known.has(normalize(candidate))) {
				values.push(candidate);
				start = end;
				matched = true;
				break;
			}
		}
		if (!matched) {
			if (parts[start].trim()) other.push(parts[start].trim());
			start += 1;
		}
	}
	if (other.length) values.push(other.join(CHECKBOX_SEPARATOR));
	return values;
}
