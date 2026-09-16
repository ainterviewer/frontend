/**
 * Writing and unwriting `code:` references, for the pane that has rows to click.
 *
 * The keyword box is the one place a code filter lives -- there is no second
 * piece of state saying which codes are selected, and deliberately so: two
 * would have to be kept agreeing, and the box is already shared, already in the
 * URL, and already the thing the reader can edit by hand. So a row that
 * filters is a row whose reference is *in the query*, and clicking it puts one
 * there or takes it out again.
 *
 * That makes this the seam where a click becomes text. `keywordQuery.ts` reads
 * the grammar; this writes the small part of it a pane needs.
 */

import { childrenOf, type Code } from '$lib/coding/codingTree';
import { codeTermsIn, keywordProblem, type CodeTermSpan } from './keywordQuery';

/** Compared the way the server compares a name, near enough to decide whether
 * one needs qualifying. Over-qualifying always resolves; under-qualifying is
 * what produces an ambiguous reference, so the doubtful case rounds up. */
function normalised(name: string): string {
	return name.trim().toLocaleLowerCase();
}

/**
 * Whether a reference has to be quoted to survive the tokenizer.
 *
 * A path always does -- it contains the `/` that separates its steps -- so in
 * practice this decides only for a bare name. Quoting one that did not need it
 * would be harmless but noisy: `code:stress` is what the reader would type.
 */
function needsQuotes(reference: string): boolean {
	return reference === '' || /[\s"()/*]/.test(reference) || /^[-!]/.test(reference);
}

/** `code` and its ancestors' names, outermost first. */
function pathOf(code: Code, codes: readonly Code[]): string[] {
	const byId = new Map(codes.map((one) => [one.id, one]));
	const steps = [code.name];
	const seen = new Set([code.id]);
	let parentId = code.parentId;
	// Guarded rather than trusted: a cycle here would hang the pane.
	while (parentId !== null && !seen.has(parentId)) {
		const parent = byId.get(parentId);
		if (!parent) break;
		steps.unshift(parent.name);
		seen.add(parent.id);
		parentId = parent.parentId;
	}
	return steps;
}

/**
 * The reference a click on this row should write.
 *
 * A bare name where the codebook holds only one of it, and the whole path from
 * the root otherwise -- which is the shape that always resolves, because the
 * server prefers a full path over a tail of one. No attempt at the *shortest*
 * qualifying tail: it would mean reimplementing the resolver here to save a
 * reader some characters they are not typing anyway.
 *
 * `/*` is appended for a code with children, which is the one place the click
 * and the keystroke deliberately differ. Typed, `code:stress` means that code
 * exactly; clicked, a branch almost always means the branch -- and the box
 * shows the `/*` that says so, which is also how the syntax gets learnt.
 */
export function codeTermFor(code: Code, codes: readonly Code[]): string {
	const sameName = codes.filter((one) => normalised(one.name) === normalised(code.name));
	const reference = sameName.length === 1 ? code.name : pathOf(code, codes).join('/');
	const written = needsQuotes(reference) ? `"${reference}"` : reference;
	const subtree = childrenOf(codes, code.id).length > 0 ? '/*' : '';
	return `code:${written}${subtree}`;
}

/** The reference in `term` without its `code:` prefix or `/*` suffix. */
function referenceOf(term: string): { text: string; subtree: boolean } {
	const spans = codeTermsIn(term);
	if (spans.length !== 1) return { text: '', subtree: false };
	return { text: spans[0].text, subtree: spans[0].subtree };
}

/** Which reference in `query` is the one `term` would write, if any. */
export function findCodeTerm(query: string, term: string): CodeTermSpan | null {
	const wanted = referenceOf(term);
	if (!wanted.text) return null;
	return (
		codeTermsIn(query).find(
			(span) => normalised(span.text) === normalised(wanted.text) && span.subtree === wanted.subtree
		) ?? null
	);
}

/** Whether this code's reference is currently narrowing the corpus. */
export function isFiltering(query: string, term: string): boolean {
	return findCodeTerm(query, term) !== null;
}

/**
 * Operators left holding nothing once a reference is cut out.
 *
 * Applied until the text stops changing, because one repair uncovers another:
 * `(code:x OR code:y)` losing both leaves `( OR )`, which is an empty bracket
 * only after the operator inside it has gone.
 */
const REPAIRS: [RegExp, string][] = [
	[/\s+/g, ' '],
	[/\(\s*\)/g, ''],
	[/\(\s*(?:AND|OR|&&|\|\|)\s+/gi, '('],
	[/\s+(?:AND|OR|NOT|&&|\|\|)\s*\)/gi, ')'],
	[/\s(?:AND|OR|&&|\|\|)\s+(?=(?:AND|OR|&&|\|\|)\s)/gi, ' '],
	[/^\s*(?:AND|OR|&&|\|\|)\s+/i, ''],
	[/\s+(?:AND|OR|NOT|&&|\|\|)\s*$/i, ''],
	[/^\s*[-!]\s*$/, ''],
	[/\s+[-!]\s*$/, '']
];

function repaired(query: string): string {
	let text = query;
	for (let pass = 0; pass < 8; pass += 1) {
		const before = text;
		for (const [pattern, replacement] of REPAIRS) text = text.replace(pattern, replacement);
		text = text.trim();
		if (text === before.trim()) break;
	}
	return text;
}

/**
 * `query` with this code's reference put in or taken out.
 *
 * Returns `null` where taking it out cannot leave a query that reads -- the
 * caller then leaves the row filtering and lets the box be edited by hand.
 * Rare enough to be worth a null rather than a guess: every expression the pane
 * itself writes is references separated by spaces, and the repairs cover the
 * bracketed and negated shapes somebody types. What they cannot cover is
 * anything, and quietly producing a broken query would be worse than declining.
 */
export function toggleCodeTerm(query: string, term: string): string | null {
	const found = findCodeTerm(query, term);

	if (found === null) {
		// Adjacency is AND, which is what a second code picked from a codebook
		// means: narrow to what carries both.
		const existing = query.trim();
		return existing ? `${existing} ${term}` : term;
	}

	const cut = repaired(query.slice(0, found.start) + ' ' + query.slice(found.end));
	return keywordProblem(cut) === null ? cut : null;
}
