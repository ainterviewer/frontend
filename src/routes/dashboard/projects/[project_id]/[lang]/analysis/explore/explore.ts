import type {
	EmbeddingClusterPoint,
	EmbeddingGroup,
	EmbeddingKind,
	GroupKind,
	InterviewStatus,
	Projection,
	QueryTask
} from '$lib/api/types.gen';

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

/**
 * How the vectors are reduced before HDBSCAN runs and before anything is
 * plotted. Both options cluster in exactly the space the scatter shows, so a
 * blob on screen is never a shape the clustering did not see — they differ in
 * what that space is.
 */
export const PROJECTIONS: { value: Projection; label: string; hint: string }[] = [
	{
		value: 'umap',
		label: 'UMAP',
		hint: 'Non-linear, straight to two dimensions. Separates neighbourhoods far more sharply and is usually the readable picture. Costs seconds rather than milliseconds, reports no variance figure, and can split one topic in two — check the representatives before believing a split.'
	},
	{
		value: 'pca',
		label: 'PCA',
		hint: 'Linear, 50 components, milliseconds — and the two plotted axes carry a stated share of the total variance. Its weakness is that 50 dimensions of text embedding are still enough for distances to concentrate, so HDBSCAN tends to find a few large blobs rather than themes.'
	}
];

/** The API's default, and the better first look. */
export const DEFAULT_PROJECTION: Projection = 'umap';

/**
 * UMAP's two shape knobs, at the API's defaults.
 *
 * `n_neighbors` is how much of the corpus each point is fitted against: low
 * values keep local detail and fragment, high values recover global structure
 * and smooth it away. `min_dist` is how tightly points may pack — 0 gives the
 * clumped layout HDBSCAN reads best, and raising it spreads a blob out for
 * looking at rather than for clustering.
 */
export const DEFAULT_N_NEIGHBORS = 15;
export const DEFAULT_MIN_DIST = 0;

/** Bounds the API enforces, checked here so 422 is never the first feedback. */
export const N_NEIGHBORS_RANGE = { min: 2, max: 200 } as const;
export const MIN_DIST_RANGE = { min: 0, max: 1, step: 0.05 } as const;

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

/**
 * Centring on language, on by default for the same reason.
 *
 * A multilingual corpus embeds language as one of the loudest signals in the
 * vector: the Danish answers sit with the Danish answers whatever anybody
 * said. Subtracting each language's mean vector removes that and leaves what
 * the answers are about, which is the only question the map is being asked.
 * On a corpus that is entirely one language it subtracts a single mean from
 * everything and changes nothing, so it costs a monolingual project nothing to
 * leave on.
 *
 * The API defaults it to `false`; the page turns it on visibly, with a toggle
 * and a purity figure per cluster, exactly as it does for questions.
 */
export const DEFAULT_CENTER_BY_LANGUAGE = true;

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
	projection: Projection;
	n_neighbors: number;
	min_dist: number;
	min_cluster_size: number;
	center_by_question: boolean;
	center_by_language: boolean;
	filters: ExploreFilters;
};

export function defaultClusterSettings(): ClusterSettings {
	return {
		kind: DEFAULT_KIND,
		projection: DEFAULT_PROJECTION,
		n_neighbors: DEFAULT_N_NEIGHBORS,
		min_dist: DEFAULT_MIN_DIST,
		min_cluster_size: DEFAULT_MIN_CLUSTER_SIZE,
		center_by_question: DEFAULT_CENTER_BY_QUESTION,
		center_by_language: DEFAULT_CENTER_BY_LANGUAGE,
		filters: defaultFilters()
	};
}

export function clusterQuery(settings: ClusterSettings) {
	return {
		kind: settings.kind,
		projection: settings.projection,
		// Left off under PCA, which ignores them: sending them anyway would make
		// a UMAP knob the reader is not currently using into a reason to refetch.
		...(settings.projection === 'umap'
			? { n_neighbors: settings.n_neighbors, min_dist: settings.min_dist }
			: {}),
		min_cluster_size: settings.min_cluster_size,
		center_by_question: settings.center_by_question,
		center_by_language: settings.center_by_language,
		n_representatives: N_REPRESENTATIVES,
		...filterQuery(settings.filters)
	};
}

/**
 * The settings the toolbar owns, as one string.
 *
 * Everything else lives behind the tuning panel, and the two are used
 * differently: the toolbar's controls are dragged and flicked through while
 * reading the map, the panel's are set once and left. That difference is worth
 * a different debounce, and this is the only thing that tells them apart —
 * there is no event to listen to, because both write the same settings object.
 */
function toolbarFingerprint(settings: ClusterSettings) {
	return `${settings.kind}:${settings.min_cluster_size}`;
}

/**
 * Whether a settings change came from the toolbar rather than the panel. A
 * first run counts as one, so nothing waits longer than it has to on load.
 */
export function isToolbarChange(previous: ClusterSettings | null, next: ClusterSettings) {
	return previous === null || toolbarFingerprint(previous) !== toolbarFingerprint(next);
}

/**
 * How many settings are away from where the page starts.
 *
 * Lives here rather than in the rail because it is read in two places — the
 * rail's reset button and the button that reopens it — and two counts that can
 * disagree are worse than no count at all.
 *
 * `center_by_language` counts only where it does anything: a monolingual
 * project would otherwise wear a badge for a setting it is not shown and could
 * not change.
 */
export function offDefaultCount(settings: ClusterSettings, multilingual: boolean) {
	const fallback = defaultClusterSettings();
	return [
		settings.projection !== fallback.projection,
		settings.projection === 'umap' && settings.n_neighbors !== fallback.n_neighbors,
		settings.projection === 'umap' && settings.min_dist !== fallback.min_dist,
		settings.min_cluster_size !== fallback.min_cluster_size,
		settings.center_by_question !== fallback.center_by_question,
		multilingual && settings.center_by_language !== fallback.center_by_language,
		settings.filters.status !== fallback.filters.status,
		settings.filters.include_synthetic !== fallback.filters.include_synthetic
	].filter(Boolean).length;
}

/** Whether the response `load` preloaded answers these settings. */
export function isDefaultClusterSettings(settings: ClusterSettings) {
	const fallback = defaultClusterSettings();
	return (
		settings.kind === fallback.kind &&
		settings.projection === fallback.projection &&
		settings.n_neighbors === fallback.n_neighbors &&
		settings.min_dist === fallback.min_dist &&
		settings.min_cluster_size === fallback.min_cluster_size &&
		settings.center_by_question === fallback.center_by_question &&
		settings.center_by_language === fallback.center_by_language &&
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

/**
 * What the map is coloured by.
 *
 * `cluster` is what HDBSCAN found; the rest are declared rather than
 * discovered — two by the interview guide, one by the respondent. Offering
 * them is the point: a cluster is only a finding if it is *not* one of these,
 * and the fastest way to see that is to recolour the same scatter and watch
 * whether the blobs stay put.
 */
export const GROUP_MODES: { value: GroupKind; label: string; hint: string }[] = [
	{
		value: 'cluster',
		label: 'Clusters',
		hint: 'Groups HDBSCAN found in the vectors. Unnamed by construction — the panel lists the chunks nearest each centre so you can name them.'
	},
	{
		value: 'question',
		label: 'Questions',
		hint: 'The interview guide’s own questions. Colour by these to see whether a cluster is a theme or just a question everyone was asked.'
	},
	{
		value: 'section',
		label: 'Sections',
		hint: 'The guide’s sections. Broader than questions, and the quickest read on whether the map is recovering the guide’s structure.'
	},
	{
		value: 'language',
		label: 'Languages',
		hint: 'The language each interview was answered in. If the blobs line up with these, the map has found which language people spoke rather than what they said — turn on centring by language.'
	}
];

export const DEFAULT_GROUP_MODE: GroupKind = 'cluster';

/**
 * The group a point belongs to under one mode, or `null` when it belongs to
 * none — an outlier under clustering, or a chunk with no guide coordinates,
 * which is every interview-level chunk.
 *
 * Keys are strings for all three modes so one `focusedGroup` covers them:
 * a cluster's key is its id written out, and a guide group's is its
 * coordinates, matching `EmbeddingGroup.key` from the API.
 */
export function groupKeyOf(point: EmbeddingClusterPoint, mode: GroupKind): string | null {
	if (mode === 'cluster') return point.cluster === null ? null : String(point.cluster);
	// Every chunk has a language, guide coordinates or not, so this one never
	// leaves a point ungrouped.
	if (mode === 'language') return point.language;
	if (point.section === null || point.section === undefined) return null;
	if (mode === 'section') return String(point.section);
	if (point.main_question === null || point.main_question === undefined) return null;
	return `${point.section}.${point.main_question}`;
}

/** The declared groups of one kind, in the order the API lists them. */
export function guideGroups(groups: EmbeddingGroup[], mode: GroupKind): EmbeddingGroup[] {
	if (mode === 'cluster') return [];
	return groups.filter((group) => group.kind === mode);
}

/**
 * Group key to palette position, so a colour belongs to a group rather than to
 * whatever order the points happened to arrive in. Cluster ids are already
 * positions; every other key takes its place in the legend.
 */
export function groupOrder(groups: EmbeddingGroup[], mode: GroupKind): Map<string, number> {
	return new Map(guideGroups(groups, mode).map((group, index) => [group.key, index]));
}
