import { flushSync } from 'svelte';
import { describe, expect, it } from 'vitest';

import { type Page, PagedQuery } from './pagedQuery.svelte';

type Body = { items?: string[]; total?: number };
type Call = {
	params: string;
	offset: number;
	signal?: AbortSignal;
	resolve: (page: Page<Body>) => void;
};

/**
 * A query whose requests wait until the test answers them, so each test
 * decides what lands and in which order.
 */
function setup(onsettled?: (outcome: { ok: boolean }) => void) {
	const calls: Call[] = [];
	const query = new PagedQuery<string, Body>({
		fetch: (params, offset, signal) =>
			new Promise((resolve) => calls.push({ params, offset, signal, resolve })),
		failure: (params) => `Could not load ${params}.`,
		moreFailure: 'Could not load more.',
		onsettled
	});
	return { query, calls };
}

const ok = (items: string[], total = 100): Page<Body> => ({ data: { items, total } });
const failed = (status: number): Page<Body> => ({
	error: { detail: 'nope' },
	response: new Response(null, { status })
});
/** Let the awaited request's continuation run. */
const settle = () => new Promise((resolve) => setTimeout(resolve));

describe('the first page', () => {
	it('loads for the params it was run with', async () => {
		const { query, calls } = setup();
		query.run('cats');

		expect(query.loading).toBe(true);
		expect(calls).toHaveLength(1);
		expect(calls[0]).toMatchObject({ params: 'cats', offset: 0 });

		calls[0].resolve(ok(['a', 'b']));
		await settle();

		expect(query.loading).toBe(false);
		expect(query.hits).toEqual(['a', 'b']);
		expect(query.response?.total).toBe(100);
		expect(query.error).toBeNull();
	});

	it('clears everything when run with nothing to fetch', async () => {
		const { query, calls } = setup();
		query.run('cats');
		calls[0].resolve(ok(['a']));
		await settle();

		query.run(null);

		expect(calls).toHaveLength(1);
		expect(query.hits).toEqual([]);
		expect(query.response).toBeNull();
		expect(query.loading).toBe(false);
	});

	it('says what failed and drops the previous results', async () => {
		const { query, calls } = setup();
		query.run('cats');
		calls[0].resolve(ok(['a']));
		await settle();

		query.run('dogs');
		calls[1].resolve(failed(500));
		await settle();

		expect(query.error).toBe('Could not load dogs.');
		expect(query.hits).toEqual([]);
		expect(query.response).toBeNull();
	});

	it('reports how the first page went, and only the first', async () => {
		const outcomes: boolean[] = [];
		const { query, calls } = setup((outcome) => outcomes.push(outcome.ok));
		query.run('cats');
		calls[0].resolve(ok(['a']));
		await settle();

		void query.loadMore();
		calls[1].resolve(failed(500));
		await settle();

		query.run('dogs');
		calls[2].resolve(failed(500));
		await settle();

		expect(outcomes).toEqual([true, false]);
	});

	it('writes nothing once its cleanup has run', async () => {
		const { query, calls } = setup();
		const cleanup = query.run('cats');
		cleanup?.();

		expect(calls[0].signal?.aborted).toBe(true);

		calls[0].resolve(ok(['late']));
		await settle();

		expect(query.hits).toEqual([]);
		expect(query.loading).toBe(true);
	});
});

describe('load more', () => {
	async function loaded() {
		const setupResult = setup();
		setupResult.query.run('cats');
		setupResult.calls[0].resolve(ok(['a', 'b']));
		await settle();
		return setupResult;
	}

	it('appends the next page of the same query', async () => {
		const { query, calls } = await loaded();
		void query.loadMore();

		expect(query.moreLoading).toBe(true);
		expect(calls[1]).toMatchObject({ params: 'cats', offset: 2, signal: undefined });

		calls[1].resolve(ok(['c'], 3));
		await settle();

		expect(query.moreLoading).toBe(false);
		expect(query.hits).toEqual(['a', 'b', 'c']);
		expect(query.response?.total).toBe(3);
	});

	it('does nothing before a first page has landed', () => {
		const { query, calls } = setup();
		query.run('cats');
		void query.loadMore();

		expect(calls).toHaveLength(1);
	});

	it('does not ask twice while a page is on its way', async () => {
		const { query, calls } = await loaded();
		void query.loadMore();
		void query.loadMore();

		expect(calls).toHaveLength(2);
	});

	it('keeps the list on screen when a page fails', async () => {
		const { query, calls } = await loaded();
		void query.loadMore();
		calls[1].resolve(failed(500));
		await settle();

		expect(query.hits).toEqual(['a', 'b']);
		expect(query.error).toBeNull();
		expect(query.moreError).toBe('Could not load more.');
	});

	it('drops a page that lands after the query changed', async () => {
		const { query, calls } = await loaded();
		void query.loadMore();
		query.run('dogs');

		expect(query.moreLoading).toBe(false);

		calls[1].resolve(ok(['stale']));
		calls[2].resolve(ok(['x']));
		await settle();

		expect(query.hits).toEqual(['x']);
	});

	it('forgets a failed page once the query changes', async () => {
		const { query, calls } = await loaded();
		void query.loadMore();
		calls[1].resolve(failed(500));
		await settle();

		query.run('dogs');

		expect(query.moreError).toBeNull();
	});
});

describe('driven by an effect', () => {
	it('refetches when an input changes and does not loop on its own results', async () => {
		const { query, calls } = setup();
		let input = $state('cats');

		const destroy = $effect.root(() => {
			$effect(() => query.run(input));
		});
		flushSync();

		calls[0].resolve(ok(['a']));
		await settle();
		flushSync();

		expect(calls).toHaveLength(1);

		input = 'dogs';
		flushSync();

		expect(calls).toHaveLength(2);
		expect(calls[0].signal?.aborted).toBe(true);
		expect(calls[1].params).toBe('dogs');

		destroy();

		expect(calls[1].signal?.aborted).toBe(true);
	});
});
