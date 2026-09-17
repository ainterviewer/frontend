import { describe, expect, it, vi } from 'vitest';
import { ExploreState, KEYWORD_DEBOUNCE_MS } from './exploreState.svelte';

/**
 * The gap between the keyword box and the corpus.
 *
 * Two values, deliberately: `keyword` is what was typed and answers at once,
 * `searchableKeyword` is what the requests carry and waits for a pause. Every
 * view refetches on the filters changing, so a query typed a character at a
 * time would otherwise be a scan of the corpus per character.
 */
describe('the keyword settles before the corpus follows', () => {
	it('shows what was typed immediately', () => {
		const explore = new ExploreState();
		explore.keyword = 'hund';

		expect(explore.keyword).toBe('hund');
	});

	it('leaves the requests alone until the typing stops', () => {
		vi.useFakeTimers();
		try {
			const explore = new ExploreState();
			explore.keyword = 'hund';

			expect(explore.searchableKeyword).toBe('');

			vi.advanceTimersByTime(KEYWORD_DEBOUNCE_MS);
			expect(explore.searchableKeyword).toBe('hund');
		} finally {
			vi.useRealTimers();
		}
	});

	it('sends the last thing typed and nothing on the way to it', () => {
		vi.useFakeTimers();
		try {
			const explore = new ExploreState();
			for (const typed of ['h', 'hu', 'hun', 'hund']) {
				explore.keyword = typed;
				vi.advanceTimersByTime(KEYWORD_DEBOUNCE_MS - 50);
			}

			// Four keystrokes inside one pause: still nothing asked for.
			expect(explore.searchableKeyword).toBe('');

			vi.advanceTimersByTime(KEYWORD_DEBOUNCE_MS);
			expect(explore.searchableKeyword).toBe('hund');
		} finally {
			vi.useRealTimers();
		}
	});

	it('reports a problem with the box rather than with what settled', () => {
		vi.useFakeTimers();
		try {
			const explore = new ExploreState();
			explore.keyword = '(hund';

			// The reader learns about the bracket while looking at it, which is the
			// whole reason the client parses at all.
			expect(explore.keywordProblem).not.toBeNull();

			// And the filter drops once the half-typed query is what the requests
			// would carry: a corpus narrowed by something the box no longer says is
			// a view disagreeing with its own controls.
			vi.advanceTimersByTime(KEYWORD_DEBOUNCE_MS);
			expect(explore.searchableKeyword).toBe('');
		} finally {
			vi.useRealTimers();
		}
	});

	it('opens a link on its keyword without waiting', () => {
		// A link arrives complete. Letting it settle would spend the first
		// request of the page on the unfiltered corpus and then replace it.
		const explore = new ExploreState({
			...new ExploreState().urlState('', 'cluster'),
			filters: { ...new ExploreState().filters, keyword: 'hund OR kat' }
		});

		expect(explore.searchableKeyword).toBe('hund OR kat');
	});
});
