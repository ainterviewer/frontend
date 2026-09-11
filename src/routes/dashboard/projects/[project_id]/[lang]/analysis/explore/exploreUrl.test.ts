import { describe, expect, it } from 'vitest';
import { defaultFilters } from './explore';
import {
	defaultExploreUrl,
	exploreUrlSearch,
	readExploreUrl,
	type ExploreUrlState
} from './exploreUrl';

/** The state one query string describes. */
function read(search: string): ExploreUrlState {
	return readExploreUrl(new URLSearchParams(search));
}

/** What a state writes, read straight back. The round trip these rest on. */
function roundTrip(state: ExploreUrlState): ExploreUrlState {
	return read(exploreUrlSearch(state));
}

describe('a view at its defaults', () => {
	it('writes no query string at all', () => {
		// An untouched page should not wear a URL saying so: what is in the link
		// is exactly what the reader changed.
		expect(exploreUrlSearch(defaultExploreUrl())).toBe('');
	});

	it('is what an empty query string reads as', () => {
		expect(read('')).toEqual(defaultExploreUrl());
	});
});

describe('the round trip', () => {
	it('survives a fully narrowed view', () => {
		const state: ExploreUrlState = {
			...defaultExploreUrl(),
			view: 'map',
			kind: 'qa_pair',
			query: 'what stresses people',
			filters: {
				...defaultFilters(),
				status: 'completed',
				languages: ['DA', 'EN'],
				include_synthetic: true,
				questions: [
					[0, 2],
					[1, 0]
				],
				keyword: 'funding OR grant',
				keyword_scope: 'both',
				survey: { '0,2': ['option:1', 'text:kayaking'] },
				survey_ranges: { '0,3': ['25', '34'] }
			},
			listOrder: 'interview_desc',
			listGrouping: 'guide',
			groupMode: 'section',
			projection: 'pca',
			minClusterSize: 12,
			centerByQuestion: false,
			centerByLanguage: true,
			visibleLanguages: ['DA']
		};

		expect(roundTrip(state)).toEqual(state);
	});

	it('survives the UMAP knobs, which only that projection carries', () => {
		const state: ExploreUrlState = {
			...defaultExploreUrl(),
			projection: 'umap',
			nNeighbors: 30,
			minDist: 0.25
		};

		expect(roundTrip(state)).toEqual(state);
	});

	it('drops the UMAP knobs under PCA', () => {
		// A link should not describe controls the view it opens does not show.
		const search = exploreUrlSearch({
			...defaultExploreUrl(),
			projection: 'pca',
			nNeighbors: 30,
			minDist: 0.25
		});

		expect(search).not.toContain('neighbours');
		expect(search).not.toContain('min_dist');
	});

	it('leaves the keyword scope off without a keyword', () => {
		// Alone it cannot change what is on screen, so a link carrying it would
		// differ from one that does not while showing the same thing.
		const search = exploreUrlSearch({
			...defaultExploreUrl(),
			filters: { ...defaultFilters(), keyword_scope: 'question' }
		});

		expect(search).toBe('');
	});
});

describe('a hand-edited or stale link', () => {
	it('falls back rather than throwing', () => {
		// These arrive from other people's clipboards and from older versions of
		// this page. A view with one control in a surprising place beats a view
		// that does not render.
		const state = read(
			'view=elsewhere&unit=paragraph&status=finished&projection=tsne&sort=alphabetical' +
				'&group=nothing&colour=mood&neighbours=9999&min_dist=7&min_cluster=1'
		);

		expect(state).toEqual(defaultExploreUrl());
	});

	it('keeps the coordinates it can read and drops the rest', () => {
		const state = read('question=0,2&question=nonsense&question=1&question=-1,0&question=1,0');

		expect(state.filters.questions).toEqual([
			[0, 2],
			[1, 0]
		]);
	});

	it('ignores a survey selection whose value is not one', () => {
		const state = read('survey=0,2=option:1&survey=0,2=shouting&survey=nowhere=option:0');

		expect(state.filters.survey).toEqual({ '0,2': ['option:1'] });
	});

	it('keeps a write-in containing an equals sign whole', () => {
		// Split on the first `=`, which no coordinate can contain.
		const state = read('survey=0,2=text:a%3Db');

		expect(state.filters.survey).toEqual({ '0,2': ['text:a=b'] });
	});

	it('reads a half-open range and ignores one open at both ends', () => {
		const state = read('survey_range=0,3=25..&survey_range=1,0=..');

		expect(state.filters.survey_ranges).toEqual({ '0,3': ['25', ''] });
	});

	it('upper-cases language codes and drops what is not one', () => {
		// The column stores them upper-cased, so a lowercase code in a link must
		// match rather than quietly return nothing.
		const state = read('language=da&language=Danish&language=EN&language=da');

		expect(state.filters.languages).toEqual(['DA', 'EN']);
	});
});
