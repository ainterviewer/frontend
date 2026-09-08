import { describe, expect, it } from 'vitest';
import {
	defaultFilters,
	filterQuery,
	hasQuestion,
	isDefaultClusterSettings,
	offDefaultCount,
	sameQuestions,
	defaultClusterSettings,
	toggleQuestion,
	toggleSection
} from './explore';

describe('toggleQuestion', () => {
	it('adds a question that was not selected', () => {
		expect(toggleQuestion([], 1, 2)).toEqual([[1, 2]]);
	});

	it('removes one that was', () => {
		expect(
			toggleQuestion(
				[
					[0, 0],
					[1, 2]
				],
				1,
				2
			)
		).toEqual([[0, 0]]);
	});

	it('keeps the selection in guide order, not click order', () => {
		// The chips under the picker read down the guide, so a question picked
		// last does not appear first.
		let selected = toggleQuestion([], 2, 0);
		selected = toggleQuestion(selected, 0, 1);
		selected = toggleQuestion(selected, 0, 0);

		expect(selected).toEqual([
			[0, 0],
			[0, 1],
			[2, 0]
		]);
	});
});

describe('toggleSection', () => {
	it('selects every question the section has', () => {
		expect(toggleSection([], 1, 3)).toEqual([
			[1, 0],
			[1, 1],
			[1, 2]
		]);
	});

	it('clears the section once all of it is selected', () => {
		const whole = toggleSection([], 1, 3);

		expect(toggleSection(whole, 1, 3)).toEqual([]);
	});

	it('completes a partly selected section rather than duplicating it', () => {
		const partial: [number, number][] = [[1, 1]];

		expect(toggleSection(partial, 1, 3)).toEqual([
			[1, 0],
			[1, 1],
			[1, 2]
		]);
	});

	it('leaves other sections alone when clearing one', () => {
		const selected: [number, number][] = [
			[0, 0],
			[1, 0],
			[1, 1]
		];

		expect(toggleSection(selected, 1, 2)).toEqual([[0, 0]]);
	});
});

describe('hasQuestion', () => {
	it('matches on both coordinates, not either', () => {
		const selected: [number, number][] = [[1, 2]];

		expect(hasQuestion(selected, 1, 2)).toBe(true);
		expect(hasQuestion(selected, 2, 1)).toBe(false);
	});
});

describe('sameQuestions', () => {
	it('ignores order', () => {
		expect(
			sameQuestions(
				[
					[0, 1],
					[1, 0]
				],
				[
					[1, 0],
					[0, 1]
				]
			)
		).toBe(true);
	});

	it('separates different selections of the same size', () => {
		expect(sameQuestions([[0, 1]], [[1, 0]])).toBe(false);
	});
});

describe('filterQuery', () => {
	it('leaves the parameter off entirely when nothing is selected', () => {
		// The API reads a missing `question` as "every one"; sending an empty
		// list would be a request for none.
		expect('question' in filterQuery(defaultFilters())).toBe(false);
	});

	it('writes the pairs the API parses, zero-based', () => {
		const query = filterQuery({
			...defaultFilters(),
			questions: [
				[0, 2],
				[1, 0]
			]
		});

		expect(query.question).toEqual(['0,2', '1,0']);
	});
});

describe('filterQuery keyword', () => {
	it('is left off entirely when blank', () => {
		// Sending `keyword=''` would be a request for chunks containing nothing.
		expect('keyword' in filterQuery(defaultFilters())).toBe(false);
	});

	it('carries its modifiers only when there is a keyword', () => {
		// Two settings that cannot change the answer would otherwise be two
		// reasons to refetch.
		const query = filterQuery({ ...defaultFilters(), keyword_exact: true });

		expect('exact_match' in query).toBe(false);
	});

	it('is trimmed, with its modifiers', () => {
		const query = filterQuery({
			...defaultFilters(),
			keyword: '  funding  ',
			keyword_exact: true,
			keyword_case_sensitive: true
		});

		expect(query.keyword).toBe('funding');
		expect(query.exact_match).toBe(true);
		expect(query.case_sensitive).toBe(true);
	});

	it('counts as off-default and defeats the preloaded response', () => {
		const settings = defaultClusterSettings();
		settings.filters.keyword = 'funding';

		expect(offDefaultCount(settings, false)).toBe(1);
		expect(isDefaultClusterSettings(settings)).toBe(false);
	});
});

describe('offDefaultCount in the list', () => {
	it('does not count controls the list does not show', () => {
		// A badge promising settings to find is worse than no badge when the
		// layout and clustering groups are not on screen to find them in.
		const settings = defaultClusterSettings();
		settings.projection = 'pca';
		settings.min_cluster_size = 99;

		expect(offDefaultCount(settings, false, false)).toBe(2);
		expect(offDefaultCount(settings, false, true)).toBe(0);
	});

	it('still counts the corpus filters, which the list does show', () => {
		const settings = defaultClusterSettings();
		settings.filters.keyword = 'funding';
		settings.filters.questions = [[0, 0]];

		expect(offDefaultCount(settings, false, true)).toBe(2);
	});
});

describe('settings comparison', () => {
	it('counts a question filter as off-default', () => {
		const settings = defaultClusterSettings();
		settings.filters.questions = [[0, 0]];

		expect(offDefaultCount(settings, false)).toBe(1);
	});

	it('stops the preloaded response answering a filtered request', () => {
		const settings = defaultClusterSettings();
		settings.filters.questions = [[0, 0]];

		expect(isDefaultClusterSettings(settings)).toBe(false);
	});
});
