/**
 * The keyword box's query language, as far as the client needs to know it.
 *
 *     dog OR cat
 *     dog AND NOT puppy
 *     (dog OR cat) AND "my neighbour"
 *     kids -school
 *     climate change
 *
 * This is a *validator* and nothing more. Matching happens in SQL, where the
 * corpus is, and so does highlighting — the server reports the character ranges
 * it matched on each turn, because the scope decides them and only the side that
 * ran the query knows it. Re-deriving marks here would be a second matcher with
 * its own idea of what a letter is, marking the text as rendered rather than the
 * column the query ran against.
 *
 * The reason to parse here at all is that a malformed query should be a message
 * under the input rather than a round trip that comes back 422 — the reader
 * finds out about the missing bracket while they are still looking at it.
 *
 * It mirrors `app/db/keyword_query.py`, which is the authority: the backend
 * parses every query it is given and rejects what it cannot read, so a drift
 * between the two is a query refused twice rather than a query that runs
 * unchecked. The grammar is small and both sides have tests over the same
 * cases, which is what keeps them honest.
 */

/** The grammar's limits. The same numbers the backend enforces. */
export const MAX_TERMS = 64;
export const MAX_DEPTH = 16;
export const MAX_TERM_LENGTH = 200;

export type KeywordProblem = {
	message: string;
	/** Zero-based offset into the query, for pointing at the character. */
	position: number | null;
};

type TokenKind = 'term' | 'phrase' | 'and' | 'or' | 'not' | 'scope' | '(' | ')';

type Token = {
	kind: TokenKind;
	text: string;
	position: number;
};

/**
 * Operator spellings, matched case-insensitively: somebody typing `dog or cat`
 * means what `dog OR cat` means, and demanding capitals would mostly produce a
 * search for the literal word "or". Quoting escapes them — `"or"` is the word.
 */
const WORD_OPERATORS: Record<string, TokenKind> = {
	and: 'and',
	or: 'or',
	not: 'not',
	'&&': 'and',
	'||': 'or'
};

/** Characters that end a bare term. Everything else, punctuation included, is
 * part of it: `e-mail` and `kl.` are words people write. */
const BREAKS = new Set([' ', '\t', '\r', '\n', '\f', '\v', '(', ')', '"']);

class ParseError extends Error {
	position: number | null;

	constructor(message: string, position: number | null) {
		super(message);
		this.position = position;
	}
}

function tokenize(query: string): Token[] {
	const tokens: Token[] = [];
	let index = 0;

	while (index < query.length) {
		const char = query[index];

		if (/\s/.test(char)) {
			index += 1;
			continue;
		}

		if (char === '(' || char === ')') {
			tokens.push({ kind: char, text: char, position: index });
			index += 1;
			continue;
		}

		// `q:` / `a:` scope whatever follows them — one term, a phrase, or a whole
		// bracketed group. Recognised here but never acted on: what a scope
		// *means* is settled in SQL, and this file only decides whether a query
		// reads at all.
		const prefix = query.slice(index, index + 2).toLowerCase();
		if (
			(prefix === 'q:' || prefix === 'a:') &&
			index + 2 < query.length &&
			!/\s/.test(query[index + 2])
		) {
			tokens.push({ kind: 'scope', text: query.slice(index, index + 2), position: index });
			index += 2;
			continue;
		}

		if (char === '"') {
			const end = query.indexOf('"', index + 1);
			if (end === -1) {
				throw new ParseError('Unclosed quote — add a closing ".', index);
			}
			const text = query.slice(index + 1, end).trim();
			if (!text) {
				throw new ParseError(
					'Empty quotes — put the phrase you are looking for inside them.',
					index
				);
			}
			if (text.length > MAX_TERM_LENGTH) {
				throw new ParseError(
					`That phrase is too long (at most ${MAX_TERM_LENGTH} characters).`,
					index
				);
			}
			tokens.push({ kind: 'phrase', text, position: index });
			index = end + 1;
			continue;
		}

		// A leading `-` or `!` negates; one inside a word does not, so `e-mail`
		// keeps its hyphen.
		if (char === '-' || char === '!') {
			tokens.push({ kind: 'not', text: char, position: index });
			index += 1;
			continue;
		}

		const start = index;
		while (index < query.length && !BREAKS.has(query[index])) index += 1;
		const raw = query.slice(start, index);

		// A word after a scope is a term, never an operator: `q:or` is the word
		// "or" looked for in the question.
		const afterScope = tokens.length > 0 && tokens[tokens.length - 1].kind === 'scope';
		const operator = afterScope ? undefined : WORD_OPERATORS[raw.toLowerCase()];
		tokens.push({ kind: operator ?? 'term', text: raw, position: start });
	}

	return tokens;
}

/**
 * Recursive descent, the same grammar the backend implements:
 *
 *     query   := or
 *     or      := and (OR and)*
 *     and     := unary (AND? unary)*
 *     unary   := (NOT | '-') unary | primary
 *     primary := '(' or ')' | phrase | term
 *
 * Only the term count comes back — nothing here needs the tree, and counting is
 * what `MAX_TERMS` is checked against.
 */
class Parser {
	private index = 0;
	private depth = 0;
	private terms = 0;

	constructor(
		private tokens: Token[],
		private source: string
	) {}

	private get current(): Token | undefined {
		return this.tokens[this.index];
	}

	private at(...kinds: TokenKind[]): boolean {
		const token = this.current;
		return token !== undefined && kinds.includes(token.kind);
	}

	private advance(): Token {
		return this.tokens[this.index++];
	}

	parse(): number {
		this.parseOr();
		const token = this.current;
		if (token) {
			if (token.kind === ')') {
				throw new ParseError('Unmatched “)” — there is no “(” for it to close.', token.position);
			}
			throw new ParseError(`Unexpected “${token.text}” here.`, token.position);
		}
		if (this.terms > MAX_TERMS) {
			throw new ParseError(`Too many search terms (${this.terms}; at most ${MAX_TERMS}).`, null);
		}
		return this.terms;
	}

	private parseOr(): void {
		this.parseAnd();
		while (this.at('or')) {
			const operator = this.advance();
			this.parseAnd(operator);
		}
	}

	private parseAnd(after?: Token): void {
		this.parseUnary(after);
		for (;;) {
			if (this.at('and')) {
				const operator = this.advance();
				this.parseUnary(operator);
				continue;
			}
			// Adjacency is AND: two words in a search box mean both words.
			if (this.at('term', 'phrase', 'not', 'scope', '(')) {
				this.parseUnary();
				continue;
			}
			break;
		}
	}

	private parseUnary(after?: Token): void {
		if (this.at('not')) {
			const operator = this.advance();
			this.parseUnary(operator);
			return;
		}
		if (this.at('scope')) {
			// Distributed over whatever follows, brackets included. *Which* terms
			// end up scoped is the server's business; here it only has to parse.
			const prefix = this.advance();
			this.parseUnary(prefix);
			return;
		}
		this.parsePrimary(after);
	}

	private parsePrimary(after?: Token): void {
		const token = this.current;

		if (!token) {
			if (after) {
				throw new ParseError(`“${after.text}” needs something after it.`, after.position);
			}
			throw new ParseError('The query is empty.', this.source.length);
		}

		if (token.kind === '(') {
			this.advance();
			this.depth += 1;
			if (this.depth > MAX_DEPTH) {
				throw new ParseError(`Too many nested brackets (at most ${MAX_DEPTH}).`, token.position);
			}
			if (this.at(')')) {
				throw new ParseError('Empty brackets — put something between “(” and “)”.', token.position);
			}
			this.parseOr();
			if (!this.at(')')) {
				throw new ParseError('Unclosed “(” — add a closing bracket.', token.position);
			}
			this.advance();
			this.depth -= 1;
			return;
		}

		if (token.kind === 'phrase') {
			this.advance();
			this.terms += 1;
			return;
		}

		if (token.kind === 'term') {
			this.advance();
			this.terms += 1;
			checkBareTerm(token);
			return;
		}

		// An operator where a term was expected: `AND dog`, `dog OR OR cat`.
		if (after) {
			throw new ParseError(
				`“${after.text}” needs something after it, not “${token.text}”.`,
				after.position
			);
		}
		throw new ParseError(`“${token.text}” needs something before it.`, token.position);
	}
}

/** A bare word with its `*` edges taken off, checked for being a word at all. */
function checkBareTerm(token: Token): void {
	let text = token.text;
	if (text.startsWith('*')) text = text.slice(1);
	if (text.endsWith('*')) text = text.slice(0, -1);

	if (!text) {
		throw new ParseError(
			'“*” on its own matches everything — search for a word instead.',
			token.position
		);
	}
	if (text.length > MAX_TERM_LENGTH) {
		throw new ParseError(
			`“${text.slice(0, 20)}…” is too long (at most ${MAX_TERM_LENGTH} characters).`,
			token.position
		);
	}
}

/**
 * What is wrong with this query, or null if nothing is.
 *
 * An empty or blank query is fine — it asks for nothing, which is what an empty
 * search box should mean.
 */
export function keywordProblem(query: string): KeywordProblem | null {
	if (!query.trim()) return null;

	try {
		new Parser(tokenize(query), query).parse();
		return null;
	} catch (error) {
		if (error instanceof ParseError) {
			return { message: error.message, position: error.position };
		}
		throw error;
	}
}

/** Whether the query is safe to send. */
export function isValidKeyword(query: string): boolean {
	return keywordProblem(query) === null;
}
