import type { EmbeddingKind, InterviewStatus, QueryTask } from '$lib/api/types.gen';

/**
 * The unit of text the page works in.
 *
 * `qa_pair` leads because a respondent answer on its own is usually too short
 * to mean anything — the median one is barely a sentence — so a pair carries
 * the question and every probe that followed it. `section` is declared in the
 * API enum but never populated, so it is not offered here: an option that
 * always returns nothing is a bug report waiting to be filed.
 */
export const KINDS: { value: EmbeddingKind; label: string; hint: string }[] = [
	{
		value: 'qa_pair',
		label: 'Q&A pairs',
		hint: 'A main question, its answer, and every probe that followed. The unit most analysis wants.'
	},
	{
		value: 'message',
		label: 'Messages',
		hint: 'One respondent message of free text. Short, but grouped by what was said rather than what was asked.'
	},
	{
		value: 'interview',
		label: 'Interviews',
		hint: 'A whole transcript, for finding comparable conversations rather than comparable answers.'
	}
];

export const DEFAULT_KIND: EmbeddingKind = 'qa_pair';

/** Search is a retrieval task: a question, matched against passages that answer it. */
export const DEFAULT_TASK: QueryTask = 'retrieval';

/**
 * How many hits a search asks for. The endpoint is not paginated by design —
 * past the cut-off a ranked list stops being worth a page — so this is the
 * whole result set, not the first screen of it.
 */
export const DEFAULT_K = 10;

/** Bounds the API enforces on `k`, checked here so 422 is never the first feedback. */
export const K_RANGE = { min: 1, max: 100 } as const;

export const DEFAULT_MIN_CLUSTER_SIZE = 5;

/** Bounds the API enforces on `min_cluster_size`, same reasoning as `K_RANGE`. */
export const MIN_CLUSTER_SIZE_RANGE = { min: 2, max: 500 } as const;

/**
 * Centring on by default.
 *
 * A Q&A chunk contains its question verbatim and every respondent was asked the
 * same one, so left alone that shared text dominates the vector and the
 * clustering recovers the interview guide rather than anything anybody said —
 * measured at 92% mean question purity on the real corpus. Subtracting each
 * question's mean vector first removes the shared component and leaves the
 * variation between answers. It costs no re-embedding, only arithmetic on
 * stored vectors.
 *
 * The API defaults it to `false` because centring is a real analytical choice
 * and the backend does not make it silently. The page makes it, visibly, with a
 * toggle and a purity figure per cluster — which is a different thing from
 * hiding it.
 */
export const DEFAULT_CENTER_BY_QUESTION = true;

/** Representative chunks per cluster. Three fits the panel without scrolling. */
export const N_REPRESENTATIVES = 3;

/**
 * The filters search, similar and clusters all share. Applied in SQL before
 * anything is scored, so they narrow the pool rather than the result list:
 * asking for ten hits from completed interviews returns ten of those, not
 * whichever of the global top ten happened to be completed.
 *
 * Language is deliberately absent. The `[lang]` in the route is the language
 * the *guide* is being authored in, not a cohort — the report page pools every
 * language for the same reason — and each hit carries its own language for a
 * reader who needs to tell them apart.
 */
export type ExploreFilters = {
	status: InterviewStatus | null;
	include_synthetic: boolean;
};

export function defaultFilters(): ExploreFilters {
	return { status: null, include_synthetic: false };
}

/** The filter half of a request, with `null` status left off entirely. */
export function filterQuery(filters: ExploreFilters) {
	return {
		...(filters.status ? { status: filters.status } : {}),
		include_synthetic: filters.include_synthetic
	};
}

/** Every knob the scatter is drawn from. */
export type ClusterSettings = {
	kind: EmbeddingKind;
	min_cluster_size: number;
	center_by_question: boolean;
	filters: ExploreFilters;
};

export function defaultClusterSettings(): ClusterSettings {
	return {
		kind: DEFAULT_KIND,
		min_cluster_size: DEFAULT_MIN_CLUSTER_SIZE,
		center_by_question: DEFAULT_CENTER_BY_QUESTION,
		filters: defaultFilters()
	};
}

export function clusterQuery(settings: ClusterSettings) {
	return {
		kind: settings.kind,
		min_cluster_size: settings.min_cluster_size,
		center_by_question: settings.center_by_question,
		n_representatives: N_REPRESENTATIVES,
		...filterQuery(settings.filters)
	};
}

/** Whether the response `load` preloaded answers these settings. */
export function isDefaultClusterSettings(settings: ClusterSettings) {
	const fallback = defaultClusterSettings();
	return (
		settings.kind === fallback.kind &&
		settings.min_cluster_size === fallback.min_cluster_size &&
		settings.center_by_question === fallback.center_by_question &&
		settings.filters.status === fallback.filters.status &&
		settings.filters.include_synthetic === fallback.filters.include_synthetic
	);
}

/**
 * What went wrong, in the reader's terms.
 *
 * The distinctions the API draws here are worth carrying through: a 409 is an
 * administrator's problem and telling a researcher to rephrase their query
 * would send them chasing it for an afternoon, and a 404 deliberately does not
 * separate "no access" from "no such thing" — the API will not confirm that a
 * project exists to somebody with no role on it, and neither should this.
 */
export function describeError(status: number | undefined, fallback: string) {
	switch (status) {
		case 503:
			return 'The embedding server is not reachable right now.';
		case 409:
			return 'The embedding model has changed since this project was embedded. The corpus needs re-embedding — an administrator has to run it.';
		case 404:
			return 'Not found.';
		case 422:
			return 'The search could not be run as entered.';
		default:
			return fallback;
	}
}
