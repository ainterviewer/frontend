import { describe, expect, it } from 'vitest';
import {
	defaultFilters,
	filterQuery,
	hasQuestion,
	isDefaultClusterSettings,
	offDefaultCount,
	sameQuestions,
	defaultClusterSettings,
	setSurveyRange,
	surveyValueToken,
	toggleQuestion,
	toggleSection,
	toggleSurveyValue
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

	it('is trimmed', () => {
		const query = filterQuery({ ...defaultFilters(), keyword: '  funding  ' });

		expect(query.keyword).toBe('funding');
	});

	it('carries the operators through untouched', () => {
		// The backend parses the query, so the client sends what was typed
		// rather than anything it has taken apart.
		const query = filterQuery({ ...defaultFilters(), keyword: '(hund OR kat) -fisk' });

		expect(query.keyword).toBe('(hund OR kat) -fisk');
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

describe('the survey cohort filter', () => {
	it('adds a chosen value under its coordinate', () => {
		expect(toggleSurveyValue({}, '0,2', 'option:1')).toEqual({ '0,2': ['option:1'] });
	});

	it('drops the item once its last value is unchosen', () => {
		// Not left behind as an empty list: an item filtering on no values is
		// not a filter, and the key would make "a survey filter is applied"
		// true forever after the first click.
		expect(toggleSurveyValue({ '0,2': ['option:1'] }, '0,2', 'option:1')).toEqual({});
	});

	it('names an option by position and a write-in by its text', () => {
		expect(surveyValueToken(1, 'Male')).toBe('option:1');
		expect(surveyValueToken(null, 'genderqueer')).toBe('text:genderqueer');
	});

	it('clears a range whose ends are both empty', () => {
		// Both ends open is every answer, which is what no filter looks like.
		expect(setSurveyRange({ '0,3': ['25', '34'] }, '0,3', '', '')).toEqual({});
	});

	it('keeps a range with one end open', () => {
		expect(setSurveyRange({}, '0,3', '25', '')).toEqual({ '0,3': ['25', ''] });
	});

	it('sends one parameter per value, each carrying its coordinate', () => {
		const query = filterQuery({
			...defaultFilters(),
			survey: { '0,2': ['option:1', 'option:2'], '1,0': ['text:kayaking'] },
			survey_ranges: { '0,3': ['25', '34'] }
		});

		expect(query.survey).toEqual(['0,2=option:1', '0,2=option:2', '1,0=text:kayaking']);
		expect(query.survey_range).toEqual(['0,3=25..34']);
	});

	it('sends nothing at all when nothing is chosen', () => {
		const query = filterQuery(defaultFilters());

		expect('survey' in query).toBe(false);
		expect('survey_range' in query).toBe(false);
	});

	it('counts as one setting off default, however many items are chosen', () => {
		// The badge counts controls the reader has moved, and this is one
		// control to open.
		const settings = defaultClusterSettings();
		const before = offDefaultCount(settings, false);
		const filtered = {
			...settings,
			filters: {
				...settings.filters,
				survey: { '0,2': ['option:1'] },
				survey_ranges: { '0,3': ['25', ''] } as Record<string, [string, string]>
			}
		};

		expect(offDefaultCount(filtered, false)).toBe(before + 1);
	});

	it('is not what the preloaded cluster response answers', () => {
		const settings = defaultClusterSettings();

		expect(
			isDefaultClusterSettings({
				...settings,
				filters: { ...settings.filters, survey: { '0,2': ['option:1'] } }
			})
		).toBe(false);
	});
});
