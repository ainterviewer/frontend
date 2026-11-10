import { describe, expect, it } from 'vitest';

import { CHECKBOX_SEPARATOR, splitCheckboxAnswer } from './checkbox';

describe('splitCheckboxAnswer', () => {
	it('splits plain options', () => {
		expect(splitCheckboxAnswer('a, b', ['a', 'b', 'c'])).toEqual(['a', 'b']);
	});

	it('keeps an option holding a comma whole', () => {
		expect(splitCheckboxAnswer('Yes, often, No', ['Yes, often', 'Yes, rarely', 'No'])).toEqual([
			'Yes, often',
			'No'
		]);
	});

	it('prefers the longest option', () => {
		expect(splitCheckboxAnswer('a, b', ['a', 'a, b'])).toEqual(['a, b']);
	});

	it('returns a write-in with commas as one value', () => {
		expect(splitCheckboxAnswer('a, red, green', ['a', 'b'])).toEqual(['a', 'red, green']);
	});

	it('round-trips the separator', () => {
		const chosen = ['Maybe, later', 'Yes, often'];
		expect(
			splitCheckboxAnswer(chosen.join(CHECKBOX_SEPARATOR), ['Yes, often', 'No', 'Maybe, later'])
		).toEqual(chosen);
	});
});
