/**
 * A ranking item's answer: a JSON array of the ranked options' texts, first
 * choice first. Mirrors the library's `RankingItem.encode_answer` /
 * `parse_answer` / `describe_answer`, which the server reads it back with.
 */

/** How many options an answer ranks: the top N, or every option. */
export function rankedCount(options: string[], topN?: number | null): number {
	return topN == null ? options.length : Math.min(topN, options.length);
}

/** The answer for an order of the options (positions in `options`), its first `count`. */
export function encodeRankingAnswer(options: string[], order: number[], count: number): string {
	return JSON.stringify(order.slice(0, count).map((position) => options[position]));
}

/**
 * The ranked options of a stored answer as positions in `options`, first
 * choice first, leaving out any that is not (or no longer) an option or comes
 * again. Anything that is not such an answer reads as no ranking.
 */
export function parseRankingAnswer(answer: string, options: string[]): number[] {
	let data: unknown;
	try {
		data = JSON.parse(answer);
	} catch {
		return [];
	}
	if (!Array.isArray(data)) return [];
	const ranked: number[] = [];
	for (const option of data) {
		const position = typeof option === 'string' ? options.indexOf(option) : -1;
		if (position >= 0 && !ranked.includes(position)) ranked.push(position);
	}
	return ranked;
}

/** The answer as "1. option" lines; text that is not a ranking answer is returned as is. */
export function describeRankingAnswer(answer: string, options: string[]): string {
	const ranked = parseRankingAnswer(answer, options);
	return ranked.length
		? ranked.map((position, n) => `${n + 1}. ${options[position]}`).join('\n')
		: answer;
}

/**
 * The order the options start in: a submitted answer's ranking first, then
 * the rest in the order shown -- this interview's drawn order where the item
 * shuffles, else as authored.
 */
export function initialOrder(
	options: string[],
	optionOrder?: number[] | null,
	answer?: string
): number[] {
	const shown =
		optionOrder?.length === options.length ? optionOrder : options.map((_, position) => position);
	const ranked = answer ? parseRankingAnswer(answer, options) : [];
	return [...ranked, ...shown.filter((position) => !ranked.includes(position))];
}

/** `order` with the entry at `from` moved to `to`. */
export function moveTo<T>(order: T[], from: number, to: number): T[] {
	if (from === to || to < 0 || to >= order.length) return order;
	const next = [...order];
	const [moved] = next.splice(from, 1);
	next.splice(to, 0, moved);
	return next;
}
