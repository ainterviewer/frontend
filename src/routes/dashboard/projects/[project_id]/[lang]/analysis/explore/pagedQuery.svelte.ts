import { describeError } from './explore';

/** What an SDK call resolves to, as far as paging cares. */
export type Page<R> = { data?: R; error?: unknown; response?: Response };

export type PagedQueryOptions<P, R> = {
	/**
	 * One page of the query `params` describes, starting at `offset`.
	 *
	 * Called synchronously from `run`, so when `run` is called from an effect,
	 * whatever this reads before its first `await` is tracked by that effect.
	 * Put the reactive inputs in `params` all the same: `loadMore` calls this
	 * again with the same `params`, outside any effect.
	 */
	fetch: (params: P, offset: number, signal?: AbortSignal) => Promise<Page<R>>;
	/** The fallback message when the first page fails. */
	failure: (params: P) => string;
	/** The fallback message when a later page fails. */
	moreFailure: string;
	/** Told how each first page went. Later pages do not report. */
	onsettled?: (outcome: { ok: true } | { ok: false; error: unknown }) => void;
};

type HitOf<R extends { items?: unknown[] }> = NonNullable<R['items']>[number];

/**
 * A list fetched a page at a time, with "load more" appending to it.
 *
 * The response and the hits are held apart because the hits accumulate: a
 * second page is appended to the list rather than swapped in for it, so a
 * ranked list is read downwards the way it is written. `response` is the
 * envelope of the most recent page (its total, its anchor, what it was run
 * for).
 *
 * `run` belongs in an `$effect`, which passes it what the query depends on
 * and returns what it returns:
 *
 * ```ts
 * $effect(() => query.run(wanted ? { projectId, kind } : null));
 * ```
 *
 * `loadMore` runs outside that effect, so no abort signal cancels it. A run
 * counter does instead: a late page checks it before appending, and drops
 * itself if the list has since been replaced by a different query. The
 * counter is deliberately not `$state`. `run` both reads and writes it, and
 * an effect that did that to reactive state would retrigger itself until
 * Svelte gave up with `effect_update_depth_exceeded`. Nothing renders it.
 */
export class PagedQuery<P, R extends { items?: unknown[] }> {
	response = $state<R | null>(null);
	hits = $state<HitOf<R>[]>([]);
	loading = $state(false);
	error = $state<string | null>(null);
	moreLoading = $state(false);
	/**
	 * Why the last "load more" failed. Kept apart from `error` because the
	 * list on screen is untouched and still correct, so this is said beside
	 * the button rather than in place of the results.
	 */
	moreError = $state<string | null>(null);

	#options: PagedQueryOptions<P, R>;
	#run = 0;
	#params: P | null = null;

	constructor(options: PagedQueryOptions<P, R>) {
		this.#options = options;
	}

	/**
	 * Replace the list with the first page for `params`, or clear it for null.
	 *
	 * Returns the cleanup for the effect that calls it, which aborts the
	 * request. Reads none of this object's state, so the calling effect does
	 * not come to depend on its own results.
	 */
	run(params: P | null): (() => void) | undefined {
		this.#run += 1;
		this.#params = params;
		this.moreLoading = false;
		this.moreError = null;

		if (params === null) {
			this.response = null;
			this.hits = [];
			this.error = null;
			this.loading = false;
			return;
		}

		this.loading = true;
		const controller = new AbortController();
		void this.#first(params, controller.signal);
		return () => controller.abort();
	}

	async #first(params: P, signal: AbortSignal) {
		const { data, error, response } = await this.#options.fetch(params, 0, signal);
		if (signal.aborted) return;

		this.loading = false;
		if (error || !data) {
			this.response = null;
			this.hits = [];
			this.error = describeError(response?.status, this.#options.failure(params), error);
			this.#options.onsettled?.({ ok: false, error });
			return;
		}

		this.response = data;
		this.hits = data.items ?? [];
		this.error = null;
		this.#options.onsettled?.({ ok: true });
	}

	/** The next page of the current query, appended. */
	async loadMore() {
		const params = this.#params;
		if (this.moreLoading || !this.response || params === null) return;

		const run = this.#run;
		this.moreLoading = true;
		this.moreError = null;

		const { data, error, response } = await this.#options.fetch(params, this.hits.length);
		if (run !== this.#run) return;

		this.moreLoading = false;
		if (error || !data) {
			this.moreError = describeError(response?.status, this.#options.moreFailure);
			return;
		}

		this.response = data;
		this.hits = [...this.hits, ...(data.items ?? [])];
	}
}
