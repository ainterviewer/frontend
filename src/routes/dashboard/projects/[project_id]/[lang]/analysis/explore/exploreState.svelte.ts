import type { EmbeddingKind, InterviewStatus, LanguageCode, Projection } from '$lib/api/types.gen';
import {
	DEFAULT_CENTER_BY_LANGUAGE,
	DEFAULT_CENTER_BY_QUESTION,
	DEFAULT_KIND,
	DEFAULT_MIN_CLUSTER_SIZE,
	DEFAULT_MIN_DIST,
	DEFAULT_N_NEIGHBORS,
	DEFAULT_PROJECTION,
	type ClusterSettings,
	type ExploreFilters,
	defaultFilters
} from './explore';

/**
 * Which of the two readings of the corpus is on screen.
 *
 * They are two renderings of one query, not two pages: the map answers "what is
 * in here and how does it group", the list answers "show me the ones that say
 * this". Everything that decides *which* chunks are in play is shared between
 * them, which is the whole reason they live behind one toggle — switching view
 * must never quietly change the corpus you were looking at.
 */
export type ExploreView = 'map' | 'list';

export const DEFAULT_VIEW: ExploreView = 'map';

/**
 * Every knob both views read, in one place.
 *
 * A class rather than a pile of `$state` declarations in the page, because the
 * two views and the rail all need the same ones and props would mean spelling
 * each out three times over. The page owns the instance and the fetching; this
 * owns only what has been asked for.
 */
export class ExploreState {
	/** Which view is showing. Not a filter — it changes nothing about the corpus. */
	view = $state<ExploreView>(DEFAULT_VIEW);

	// -- shared by both views -------------------------------------------------

	kind = $state<EmbeddingKind>(DEFAULT_KIND);
	interviewStatus = $state<InterviewStatus | null>(defaultFilters().status);
	filterLanguages = $state<LanguageCode[]>(defaultFilters().languages);
	includeSynthetic = $state(defaultFilters().include_synthetic);
	filterQuestions = $state<[number, number][]>(defaultFilters().questions);

	/**
	 * The literal half of searching. A filter rather than a query: it narrows
	 * the candidate set in SQL, and whatever semantic query there is then ranks
	 * what survived. Matched against respondent messages, so a word the
	 * interviewer said does not count as a word anybody answered.
	 */
	keyword = $state(defaultFilters().keyword);
	exactMatch = $state(defaultFilters().keyword_exact);
	caseSensitive = $state(defaultFilters().keyword_case_sensitive);

	// -- the map's own --------------------------------------------------------

	projection = $state<Projection>(DEFAULT_PROJECTION);
	nNeighbors = $state(DEFAULT_N_NEIGHBORS);
	minDist = $state(DEFAULT_MIN_DIST);
	minClusterSize = $state(DEFAULT_MIN_CLUSTER_SIZE);
	centerByQuestion = $state(DEFAULT_CENTER_BY_QUESTION);
	centerByLanguage = $state(DEFAULT_CENTER_BY_LANGUAGE);

	/**
	 * Languages the reader is looking at, empty for all of them. The cheap half
	 * of the language controls: the same projection with the rest faded back,
	 * which costs a recolour rather than a request. Map-only — a list has
	 * nothing to fade.
	 */
	visibleLanguages = $state<LanguageCode[]>([]);

	/**
	 * The question filter as the requests should carry it.
	 *
	 * Emptied under the `interview` unit rather than sent: an interview chunk
	 * spans the whole guide and carries no coordinates, so any pair would filter
	 * every row away and leave an empty view with no visible cause. The
	 * selection itself is kept, so switching back to Q&A pairs restores it
	 * rather than silently discarding what was picked.
	 */
	effectiveQuestions = $derived<[number, number][]>(
		this.kind === 'interview' ? [] : this.filterQuestions
	);

	filters = $derived<ExploreFilters>({
		status: this.interviewStatus,
		languages: this.filterLanguages,
		include_synthetic: this.includeSynthetic,
		questions: this.effectiveQuestions,
		keyword: this.keyword,
		keyword_exact: this.exactMatch,
		keyword_case_sensitive: this.caseSensitive
	});

	settings = $derived<ClusterSettings>({
		kind: this.kind,
		projection: this.projection,
		n_neighbors: this.nNeighbors,
		min_dist: this.minDist,
		min_cluster_size: this.minClusterSize,
		center_by_question: this.centerByQuestion,
		center_by_language: this.centerByLanguage,
		filters: this.filters
	});

	/** Whether a keyword is actually narrowing anything. */
	filteringByKeyword = $derived(this.keyword.trim().length > 0);
}
