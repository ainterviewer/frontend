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
	type SurveyRanges,
	type SurveySelection,
	defaultFilters
} from './explore';
import { keywordProblem as findKeywordProblem } from './keywordQuery';

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

/**
 * The list opens first.
 *
 * Both views answer questions about the same corpus, but only one of them
 * answers a question a reader arrives with. "Show me where people talk about
 * stress" is a search; the map answers "what is in here at all", which is a
 * question you have after reading some of it rather than before. The map also
 * costs a UMAP fit to draw and reads as a scatter of nothing until the corpus
 * is indexed, so opening on it spends the most and says the least.
 */
export const DEFAULT_VIEW: ExploreView = 'list';

/**
 * The order an unranked list is read in.
 *
 * Only ever applies to the browse: a search and a walk are ordered by score,
 * and that order *is* the answer.
 */
export type ListOrder = 'random' | 'interview_asc' | 'interview_desc';

export const LIST_ORDERS: { value: ListOrder; label: string; hint: string }[] = [
	{
		value: 'random',
		label: 'Random',
		hint: 'A new shuffle each visit. The top of a list is read more carefully than the bottom, so a fixed order decides whose answers get the close reading — this spreads that around instead. One interview’s chunks still stay together.'
	},
	{
		value: 'interview_asc',
		label: 'Oldest first',
		hint: 'By when the interview was started, earliest first — interview #1 at the top.'
	},
	{
		value: 'interview_desc',
		label: 'Newest first',
		hint: 'By when the interview was started, most recent first. What a collection still running has just added.'
	}
];

/**
 * Shuffled by default, which is a claim about reading rather than about data.
 *
 * A researcher reads the first cards closely and the later ones faster, so
 * whatever order the corpus happens to arrive in silently chooses whose
 * answers get the attention. Guide order — interview id, then question — is
 * particularly bad at this: it is stable, so it is the *same* people every
 * time, and it looks meaningful without being so.
 */
export const DEFAULT_LIST_ORDER: ListOrder = 'random';

/**
 * The seed behind one visit's shuffle.
 *
 * Drawn once per page load and sent with every browse request, which is what
 * makes "Load more" continue the same shuffle rather than deal a new one — and
 * what makes a refresh deal a new one, deliberately. Kept to the characters the
 * endpoint accepts.
 */
function shuffleSeed(): string {
	return Math.random().toString(36).slice(2, 12);
}

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

	/** How the unranked list is ordered. Not a filter either: nothing leaves. */
	listOrder = $state<ListOrder>(DEFAULT_LIST_ORDER);

	/**
	 * This visit's shuffle, fixed for as long as the page is open.
	 *
	 * Not `$state`: it is read by the requests and never changes, and making it
	 * reactive would only invite something to reshuffle the list under a reader
	 * mid-scroll.
	 */
	readonly seed = shuffleSeed();

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
	 *
	 * A boolean expression — see `keywordQuery.ts` — so it can be malformed in
	 * a way a plain string could not. `keywordProblem` is what the input shows
	 * and `searchableKeyword` is what the requests are allowed to use.
	 */
	keyword = $state(defaultFilters().keyword);

	/**
	 * Which survey answers the interviews behind the chunks must hold, keyed by
	 * guide coordinate. A cohort filter: it selects respondents and keeps
	 * everything they said, rather than picking out their survey answers.
	 *
	 * Unlike the question filter this stays applied under the `interview` unit.
	 * An interview-level chunk has no guide coordinates of its own, but it does
	 * belong to an interview, and whose interview it is is exactly what this
	 * asks about.
	 */
	surveyValues = $state<SurveySelection>(defaultFilters().survey);
	surveyRanges = $state<SurveyRanges>(defaultFilters().survey_ranges);

	/**
	 * Which side of the exchange a bare term is looked for in.
	 *
	 * "answer" by default, and not merely for continuity: on a real corpus the
	 * guide's own words swamp the respondents'. Searching questions is a
	 * different question — "where did we ask about X" rather than "who talked
	 * about X" — and worth asking for deliberately.
	 */
	keywordScope = $state(defaultFilters().keyword_scope);

	/**
	 * What is wrong with the keyword as typed, or null while it reads.
	 *
	 * Derived rather than checked on submit because the box has no submit: the
	 * views refetch as you type, so "not yet valid" is a state the reader passes
	 * through on the way to every query with a bracket in it. Showing the
	 * problem there beats a request that comes back 422.
	 */
	keywordProblem = $derived(findKeywordProblem(this.keyword));

	/**
	 * The keyword the requests may carry: what was typed, or nothing while it
	 * does not parse.
	 *
	 * Falling back to no keyword rather than to the last good one, because a
	 * filter that stays applied while the box shows something else is a view
	 * disagreeing with its own controls. Half-typed brackets simply do not
	 * narrow anything yet.
	 */
	searchableKeyword = $derived(this.keywordProblem === null ? this.keyword : '');

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
		keyword: this.searchableKeyword,
		keyword_scope: this.keywordScope,
		survey: this.surveyValues,
		survey_ranges: this.surveyRanges
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
	filteringByKeyword = $derived(this.searchableKeyword.trim().length > 0);
}
