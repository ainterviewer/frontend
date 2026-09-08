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
