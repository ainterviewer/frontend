import { describe, expect, it } from 'vitest';
import { MAX_TERMS, isValidKeyword, keywordProblem } from './keywordQuery';

/**
 * The client's half of the keyword grammar.
 *
 * These deliberately mirror `backend/tests/test_keyword_query.py::TestErrors` —
 * the same queries, the same positions. Two parsers exist because the reader
 * should learn about a missing bracket while looking at it rather than after a
 * round trip, and the only thing that keeps two parsers honest is being asked
 * the same questions.
 */

describe('queries that read', () => {
	it.each([
		'dog',
		'climate change',
		'dog OR cat',
		'dog AND NOT puppy',
		'kids -school',
		'(dog OR cat) AND "my neighbour"',
		'a OR b AND c',
		'a && b || c',
		'!dog',
		'dog or cat',
		'"or"',
		'kat*',
		'*kat',
		'*kat*',
		'3*4',
		'e-mail',
		'100%'
	])('accepts %j', (query) => {
		expect(keywordProblem(query)).toBeNull();
	});

	it('treats an empty box as asking for nothing', () => {
		expect(keywordProblem('')).toBeNull();
		expect(keywordProblem('   ')).toBeNull();
	});
});

describe('queries that do not', () => {
	it.each([
		['(dog OR cat', 0],
		['dog)', 3],
		['dog AND', 4],
		['AND dog', 0],
		['()', 0],
		['"unclosed', 0],
		['""', 0],
		['-', 0],
		['*', 0],
		['dog OR OR cat', 4]
	])('points at the problem in %j', (query, position) => {
		const problem = keywordProblem(query as string);

		expect(problem).not.toBeNull();
		expect(problem?.position).toBe(position);
		// The message is what the reader is shown, so an empty one is a bug even
		// where the position is right.
		expect(problem?.message.length).toBeGreaterThan(0);
	});

	it('refuses more terms than the backend would accept', () => {
		const query = Array.from({ length: MAX_TERMS + 1 }, (_, index) => `w${index}`).join(' OR ');

		expect(keywordProblem(query)?.message).toContain('Too many search terms');
	});

	it('refuses brackets nested past the limit', () => {
		expect(keywordProblem('('.repeat(40) + 'dog' + ')'.repeat(40))?.message).toContain(
			'nested brackets'
		);
	});
});

describe('isValidKeyword', () => {
	it('agrees with keywordProblem', () => {
		expect(isValidKeyword('dog OR cat')).toBe(true);
		expect(isValidKeyword('(dog OR cat')).toBe(false);
	});

	it('lets a half-typed query be invalid on the way to a valid one', () => {
		// The state falls back to no keyword while this is true, so the corpus
		// stops being narrowed rather than being narrowed by something the box
		// no longer says.
		expect(isValidKeyword('(hund')).toBe(false);
		expect(isValidKeyword('(hund OR kat)')).toBe(true);
	});
});

describe('scope prefixes', () => {
	// What `q:`/`a:` *mean* is settled in SQL; this side only has to agree that
	// they read, or a valid query would be refused before it was ever sent.
	it.each([
		'q:stress',
		'a:stress',
		'q:"min nabo"',
		'q:stress a:træt',
		'-q:stress',
		'q:or',
		'q:(stress OR travlhed)',
		'q:(stress OR a:træt)'
	])('accepts %j', (query) => {
		expect(keywordProblem(query)).toBeNull();
	});

	it('leaves a bare prefix as an ordinary word', () => {
		// Nothing follows it, so there is nothing for it to scope.
		expect(keywordProblem('q:')).toBeNull();
	});
});

/**
 * Code references, mirroring `TestCodeTerms` and `TestCodeErrors` on the
 * backend. Only the *shape* is checked here — whether a name is one the
 * codebook holds is the server's answer, and comes back as a 422.
 */
describe('code references', () => {
	it.each([
		'code:stress',
		'code:stress/*',
		'code:Stress/Often',
		'code:"Stress/New code"',
		'code:"Stress/New code"/*',
		'code:"a*b"',
		'a:code:stress',
		'q:code:stress',
		'-code:stress',
		'code:or',
		'CODE:stress',
		'code:stress kids',
		'code:stress -code:workload',
		'(code:stress OR kids) AND q:arbejde',
		'a:(code:stress OR kids)'
	])('accepts %j', (query) => {
		expect(keywordProblem(query)).toBeNull();
	});

	it.each([
		['code:', 'needs the name of a code'],
		['code: stress', 'needs the name of a code'],
		['code:*', 'at the end'],
		['code:stre*', 'at the end'],
		['code:a//b', 'empty step'],
		['code:/b', 'empty step'],
		['code:"unclosed', 'Unclosed quote']
	])('rejects %j', (query, fragment) => {
		const problem = keywordProblem(query);
		expect(problem?.message).toContain(fragment);
		expect(problem?.position).not.toBeNull();
	});

	it('rejects a bare prefix, unlike a bare scope', () => {
		// `q:` alone is the ordinary word "q:", because somebody might mean it.
		// `code:` alone is a half-typed reference and nothing else.
		expect(keywordProblem('q:')).toBeNull();
		expect(keywordProblem('code:')).not.toBeNull();
	});

	it('counts a code reference towards the cap', () => {
		const query = Array.from({ length: MAX_TERMS + 1 }, (_, n) => `code:c${n}`).join(' OR ');
		expect(keywordProblem(query)?.message).toContain('Too many search terms');
	});

	it('points at the start of the reference, not inside it', () => {
		expect(keywordProblem('kids AND code:stre*')?.position).toBe(9);
	});

	it('accepts a code reference next to everything else it can sit next to', () => {
		expect(isValidKeyword('code:stress/* AND (kids OR q:"min nabo") -code:"Work/Load"')).toBe(true);
	});
});
