import { describe, expect, it } from 'vitest';

import type { Code } from '$lib/coding/codingTree';

import { codeTermFor, findCodeTerm, isFiltering, toggleCodeTerm } from './codeFilter';
import { keywordProblem } from './keywordQuery';

function code(id: string, name: string, parentId: string | null = null): Code {
	return {
		id,
		parentId,
		name,
		definition: '',
		memo: '',
		color: '#000000',
		position: null,
		kind: 'tag',
		minValue: null,
		maxValue: null
	} as Code;
}

const STRESS = code('1', 'Stress');
const OFTEN = code('2', 'Often', '1');
const WORKLOAD = code('3', 'Workload');
const TWIN_A = code('4', 'New code');
const TWIN_B = code('5', 'New code', '3');
const SPACED = code('6', 'Work life balance');
const CODES = [STRESS, OFTEN, WORKLOAD, TWIN_A, TWIN_B, SPACED];

describe('codeTermFor', () => {
	it('writes a bare name where the codebook holds only one of it', () => {
		expect(codeTermFor(OFTEN, CODES)).toBe('code:Often');
	});

	it('adds the subtree marker for a code with children', () => {
		expect(codeTermFor(STRESS, CODES)).toBe('code:Stress/*');
	});

	it('writes the whole path where the name collides', () => {
		expect(codeTermFor(TWIN_B, CODES)).toBe('code:"Workload/New code"');
	});

	it('quotes a name with spaces in it', () => {
		expect(codeTermFor(SPACED, CODES)).toBe('code:"Work life balance"');
	});

	it('writes something the grammar accepts, whatever the name', () => {
		for (const one of CODES) expect(keywordProblem(codeTermFor(one, CODES))).toBeNull();
	});

	it('writes a reference that finds itself again', () => {
		for (const one of CODES) {
			const term = codeTermFor(one, CODES);
			expect(isFiltering(term, term)).toBe(true);
		}
	});
});

describe('toggleCodeTerm', () => {
	const term = 'code:Often';

	it('adds to an empty box', () => {
		expect(toggleCodeTerm('', term)).toBe(term);
	});

	it('adds alongside what is already there, as AND', () => {
		expect(toggleCodeTerm('kids', term)).toBe('kids code:Often');
	});

	it('takes its own reference back out', () => {
		expect(toggleCodeTerm('kids code:Often', term)).toBe('kids');
	});

	it('round-trips', () => {
		const once = toggleCodeTerm('kids', term);
		expect(toggleCodeTerm(once as string, term)).toBe('kids');
	});

	it('empties the box when it was the only thing in it', () => {
		expect(toggleCodeTerm(term, term)).toBe('');
	});

	it('leaves other code references alone', () => {
		expect(toggleCodeTerm('code:Often code:Workload', term)).toBe('code:Workload');
	});

	it('tells a subtree reference from an exact one', () => {
		expect(toggleCodeTerm('code:Stress', 'code:Stress/*')).toBe('code:Stress code:Stress/*');
		expect(toggleCodeTerm('code:Stress/*', 'code:Stress/*')).toBe('');
	});

	it('is case-insensitive about the name, as the server is', () => {
		expect(toggleCodeTerm('code:often', term)).toBe('');
	});

	it('does not mistake a quoted phrase for a reference', () => {
		// The words somebody said, not a filter.
		const query = '"say code:Often"';
		expect(findCodeTerm(query, term)).toBeNull();
		expect(toggleCodeTerm(query, term)).toBe('"say code:Often" code:Often');
	});

	describe('repairing what the cut leaves behind', () => {
		it.each([
			['code:Often AND kids', 'kids'],
			['kids AND code:Often', 'kids'],
			['kids OR code:Often', 'kids'],
			['(code:Often OR kids) AND dogs', '(kids) AND dogs'],
			['-code:Often', ''],
			['kids -code:Often', 'kids'],
			['code:Often AND code:Workload', 'code:Workload']
		])('%j becomes %j', (query, expected) => {
			expect(toggleCodeTerm(query, term)).toBe(expected);
		});

		it('never leaves a query that will not read', () => {
			const queries = [
				'code:Often',
				'code:Often AND kids',
				'(code:Often OR kids)',
				'-code:Often',
				'a:(code:Often OR kids) AND dogs',
				'code:Often code:Workload kids'
			];
			for (const query of queries) {
				const next = toggleCodeTerm(query, term);
				if (next !== null) expect(keywordProblem(next)).toBeNull();
			}
		});
	});
});
