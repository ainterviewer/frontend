import { describe, expect, it } from 'vitest';

import { fixFirst, invalidParts, WOULD } from './invalidParts';

const error = { message: 'Question 1.1 has no text.' };

describe('invalidParts', () => {
	it('is empty while every part is valid', () => {
		expect(invalidParts(null)).toEqual([]);
		expect(invalidParts({ doc_errors: { guide: [] } })).toEqual([]);
	});

	it('lists the parts saved invalid, in sidebar order', () => {
		expect(invalidParts({ doc_errors: { guide: [error], welcome: [error] } })).toEqual([
			'welcome',
			'guide'
		]);
	});

	it('takes the parts known more recently from their live errors', () => {
		const saved = { doc_errors: { guide: [error] } };
		expect(invalidParts(saved, { guide: [] })).toEqual([]);
		expect(invalidParts(null, { consent: [error] })).toEqual(['consent']);
		// A part without live errors keeps its saved ones.
		expect(invalidParts(saved, { consent: [] })).toEqual(['guide']);
	});
});

describe('fixFirst', () => {
	it('says nothing when no part is invalid', () => {
		expect(fixFirst([], WOULD.try)).toBeUndefined();
	});

	it('names the parts to fix, in sidebar order, and what the action would do', () => {
		expect(fixFirst(['guide', 'welcome'], WOULD.publish)).toBe(
			'Fix the problems in the welcome page and interview guide first: publishing would release it as it was before them.'
		);
		expect(fixFirst(['guide', 'consent', 'welcome'], WOULD.try)).toMatch(
			/consent, welcome page and interview guide first: a test/
		);
	});
});
