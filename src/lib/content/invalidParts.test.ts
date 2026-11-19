import { describe, expect, it } from 'vitest';

import {
	fixFirst,
	invalidParts,
	skippedErrors,
	testSkips,
	WOULD,
	writeFirst
} from './invalidParts';

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

describe('skipped questions', () => {
	const skipped = { message: 'Question 1.6 has no text.', skipped: true };

	it('do not make their part invalid', () => {
		expect(invalidParts({ doc_errors: { guide: [skipped] } })).toEqual([]);
		expect(invalidParts({ doc_errors: { guide: [skipped, error] } })).toEqual(['guide']);
	});

	it('are taken from the live errors over the saved ones', () => {
		expect(skippedErrors({ doc_errors: { guide: [skipped] } })).toEqual({ guide: [skipped] });
		expect(skippedErrors({ doc_errors: { guide: [skipped] } }, { guide: [] })).toEqual({});
	});

	it('hold back publishing, and are named to the tester', () => {
		expect(writeFirst({})).toBeUndefined();
		expect(writeFirst({ guide: [skipped] })).toBe(
			'Question 1.6 has no text. Write the question, or delete it, before publishing.'
		);
		expect(
			testSkips({ guide: [skipped, { ...skipped, message: 'Question 2.1 has no text.' }] })
		).toBe('Question 1.6 has no text. Question 2.1 has no text. The test skips them.');
	});

	it("word the welcome page's contact email in its own terms", () => {
		const email = { message: 'Enter a contact email address.', field: 'email', skipped: true };
		expect(writeFirst({ welcome: [email] })).toBe(
			'Enter a contact email address on the welcome page, or stop showing the contact box, before publishing.'
		);
		expect(testSkips({ welcome: [email] })).toBe(
			'The welcome page has no valid contact email, so the test shows it without the contact box.'
		);
	});
});
