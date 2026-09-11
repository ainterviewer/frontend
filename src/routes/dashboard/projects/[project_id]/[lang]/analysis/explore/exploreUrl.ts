/**
 * The view, as a query string.
 *
 * Everything that decides what is on screen — the unit, the filters, the query,
 * how the list is blocked and ordered, how the map is projected and coloured —
 * lives in the URL, so a reading is a link. That is what the page is for: a
 * finding is "people in section 3 who mention funding", and until this existed
 * the only way to hand that to a colleague was a list of controls to re-set by
 * hand, with no way to know whether they had set them the same.
 *
 * Two rules run through all of it:
 *
 * **Defaults are absent.** A parameter is written only where it differs from
 * what the page opens on, so an untouched view has a bare URL and a shared one
 * says exactly what was changed — which is also what makes the link readable.
 * The cost is that the defaults become part of the contract: changing one
 * re-points every link that relied on it being absent.
 *
 * **A bad value is the default, never an error.** These arrive from other
 * people's clipboards, from an older version of this page, and from readers
 * editing the address bar; a view that renders with one control in a surprising
 * place beats one that renders nothing. Nothing here throws.
 *
 * Deliberately *not* carried: the anchored chunk and the open transcript, which
 * are places a reader walked to rather than a corpus; the shuffle seed, so a
 * shared random list is still shuffled for whoever opens it; and the rail,
 * which is furniture.
 */
import type {
	EmbeddingKind,
	GroupKind,
	InterviewStatus,
	LanguageCode,
	Projection
} from '$lib/api/types.gen';
import {
	DEFAULT_CENTER_BY_LANGUAGE,
	DEFAULT_CENTER_BY_QUESTION,
	DEFAULT_GROUP_MODE,
	DEFAULT_KIND,
	DEFAULT_MIN_CLUSTER_SIZE,
	DEFAULT_MIN_DIST,
	DEFAULT_N_NEIGHBORS,
	DEFAULT_PROJECTION,
	GROUP_MODES,
	KINDS,
	MIN_CLUSTER_SIZE_RANGE,
	MIN_DIST_RANGE,
	N_NEIGHBORS_RANGE,
	PROJECTIONS,
	defaultFilters,
	type ClusterSettings,
	type ExploreFilters,
	type KeywordScope,
	type SurveyRanges,
	type SurveySelection
} from './explore';
import {
	DEFAULT_LIST_GROUPING,
	DEFAULT_LIST_ORDER,
	DEFAULT_VIEW,
	LIST_GROUPINGS,
	LIST_ORDERS,
	type ExploreView,
	type ListGrouping,
	type ListOrder
} from './exploreState.svelte';

/**
 * Everything the URL can say, as one object.
 *
 * The same shape going both ways, so the round trip is a thing a test can
 * state: read what was written and you are where you were.
 */
export type ExploreUrlState = {
	view: ExploreView;
	kind: EmbeddingKind;
	/** The semantic query that was actually run, not what is half-typed in the box. */
	query: string;
	filters: ExploreFilters;
	listOrder: ListOrder;
	listGrouping: ListGrouping;
	/** What the scatter is coloured by. */
	groupMode: GroupKind;
	projection: Projection;
	nNeighbors: number;
	minDist: number;
	minClusterSize: number;
	centerByQuestion: boolean;
	centerByLanguage: boolean;
	visibleLanguages: LanguageCode[];
};

/** Where the page opens, which is also everything the URL leaves unsaid. */
export function defaultExploreUrl(): ExploreUrlState {
	return {
		view: DEFAULT_VIEW,
		kind: DEFAULT_KIND,
		query: '',
		filters: defaultFilters(),
		listOrder: DEFAULT_LIST_ORDER,
		listGrouping: DEFAULT_LIST_GROUPING,
		groupMode: DEFAULT_GROUP_MODE,
		projection: DEFAULT_PROJECTION,
		nNeighbors: DEFAULT_N_NEIGHBORS,
		minDist: DEFAULT_MIN_DIST,
		minClusterSize: DEFAULT_MIN_CLUSTER_SIZE,
		centerByQuestion: DEFAULT_CENTER_BY_QUESTION,
		centerByLanguage: DEFAULT_CENTER_BY_LANGUAGE,
		visibleLanguages: []
	};
}

/** One of a known set, or the fallback. */
function oneOf<T extends string>(raw: string | null, allowed: readonly T[], fallback: T): T {
	return raw !== null && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
}

/** A flag, written `1`. Anything else is off, including a missing parameter. */
function flag(raw: string | null, fallback: boolean) {
	if (raw === null) return fallback;
	return raw === '1' || raw === 'true';
}

/** A number inside its control's own bounds, or the fallback. */
function bounded(
	raw: string | null,
	{ min, max }: { min: number; max: number },
	fallback: number,
	whole = true
) {
	if (raw === null) return fallback;
	const value = whole ? Number.parseInt(raw, 10) : Number.parseFloat(raw);
	if (!Number.isFinite(value) || value < min || value > max) return fallback;
	return value;
}

/**
 * `["0,2", "1,0"]` to the pairs the filter holds, dropping anything that is not
 * one.
 *
 * Guide coordinates are a pair and a query string has no type for one, so they
 * are spelled the way the API spells them — which is also the spelling the
 * annotate view uses, so a coordinate reads the same wherever it appears.
 */
function readQuestions(raw: string[]): [number, number][] {
	const questions: [number, number][] = [];
	for (const value of raw) {
		const parts = value.split(',');
		if (parts.length !== 2) continue;
		const [section, question] = parts.map((part) => Number.parseInt(part, 10));
		if (!Number.isInteger(section) || !Number.isInteger(question)) continue;
		if (section < 0 || question < 0) continue;
		if (questions.some(([s, q]) => s === section && q === question)) continue;
		questions.push([section, question]);
	}
	return questions.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

/** Language codes as the column stores them: two letters, upper-cased. */
function readLanguages(raw: string[]): LanguageCode[] {
	const codes: LanguageCode[] = [];
	for (const value of raw) {
		const code = value.trim().toUpperCase();
		if (!/^[A-Z]{2}$/.test(code) || codes.includes(code)) continue;
		codes.push(code);
	}
	return codes;
}

/**
 * `["0,2=option:1"]` to the values chosen per item.
 *
 * Split on the *first* `=`, which no coordinate can contain — so a write-in
 * holding one, as a text answer easily might, still arrives whole.
 */
function readSurvey(raw: string[]): SurveySelection {
	const chosen: SurveySelection = {};
	for (const entry of raw) {
		const separator = entry.indexOf('=');
		if (separator < 1) continue;
		const key = entry.slice(0, separator);
		const token = entry.slice(separator + 1);
		if (readQuestions([key]).length === 0) continue;
		if (!token.startsWith('option:') && !token.startsWith('text:')) continue;
		const tokens = (chosen[key] ??= []);
		if (!tokens.includes(token)) tokens.push(token);
	}
	return chosen;
}

/** `["0,3=25..34"]` to a range per item, either end allowed to be empty. */
function readSurveyRanges(raw: string[]): SurveyRanges {
	const ranges: SurveyRanges = {};
	for (const entry of raw) {
		const separator = entry.indexOf('=');
		if (separator < 1) continue;
		const key = entry.slice(0, separator);
		const bounds = entry.slice(separator + 1);
		const at = bounds.indexOf('..');
		if (at < 0) continue;
		if (readQuestions([key]).length === 0) continue;
		const low = bounds.slice(0, at);
		const high = bounds.slice(at + 2);
		// Both ends open is every answer, which is what no filter looks like.
		if (!low && !high) continue;
		ranges[key] = [low, high];
	}
	return ranges;
}

/** The view one query string describes. Never throws; see the module note. */
export function readExploreUrl(params: URLSearchParams): ExploreUrlState {
	const fallback = defaultExploreUrl();
	const filters = defaultFilters();

	return {
		view: oneOf<ExploreView>(params.get('view'), ['map', 'list'], fallback.view),
		kind: oneOf(
			params.get('unit'),
			KINDS.map((option) => option.value),
			fallback.kind
		),
		query: params.get('q') ?? '',
		filters: {
			...filters,
			status:
				oneOf<InterviewStatus | ''>(
					params.get('status'),
					['active', 'inactive', 'completed'],
					''
				) || null,
			languages: readLanguages(params.getAll('language')),
			include_synthetic: flag(params.get('synthetic'), filters.include_synthetic),
			questions: readQuestions(params.getAll('question')),
			keyword: params.get('keyword') ?? '',
			keyword_scope: oneOf<KeywordScope>(
				params.get('keyword_scope'),
				['answer', 'question', 'both'],
				filters.keyword_scope
			),
			survey: readSurvey(params.getAll('survey')),
			survey_ranges: readSurveyRanges(params.getAll('survey_range'))
		},
		listOrder: oneOf(
			params.get('sort'),
			LIST_ORDERS.map((option) => option.value),
			fallback.listOrder
		),
		listGrouping: oneOf(
			params.get('group'),
			LIST_GROUPINGS.map((option) => option.value),
			fallback.listGrouping
		),
		groupMode: oneOf(
			params.get('colour'),
			GROUP_MODES.map((option) => option.value),
			fallback.groupMode
		),
		projection: oneOf(
			params.get('projection'),
			PROJECTIONS.map((option) => option.value),
			fallback.projection
		),
		nNeighbors: bounded(params.get('neighbours'), N_NEIGHBORS_RANGE, fallback.nNeighbors),
		minDist: bounded(params.get('min_dist'), MIN_DIST_RANGE, fallback.minDist, false),
		minClusterSize: bounded(
			params.get('min_cluster'),
			MIN_CLUSTER_SIZE_RANGE,
			fallback.minClusterSize
		),
		centerByQuestion: flag(params.get('centre_question'), fallback.centerByQuestion),
		centerByLanguage: flag(params.get('centre_language'), fallback.centerByLanguage),
		visibleLanguages: readLanguages(params.getAll('show'))
	};
}

/**
 * The query string for a view, with everything default left out.
 *
 * Ordered as the page is read rather than alphabetically — what is being looked
 * at, then what has been narrowed, then how it is drawn — because the first
 * thing anybody does with one of these links is read it.
 */
export function exploreUrlParams(state: ExploreUrlState): URLSearchParams {
	const fallback = defaultExploreUrl();
	const params = new URLSearchParams();

	if (state.view !== fallback.view) params.set('view', state.view);
	if (state.kind !== fallback.kind) params.set('unit', state.kind);
	if (state.query.trim()) params.set('q', state.query.trim());

	const { filters } = state;
	if (filters.status) params.set('status', filters.status);
	for (const code of filters.languages) params.append('language', code);
	if (filters.include_synthetic !== fallback.filters.include_synthetic) {
		params.set('synthetic', '1');
	}
	for (const [section, question] of filters.questions) {
		params.append('question', `${section},${question}`);
	}
	if (filters.keyword.trim()) {
		params.set('keyword', filters.keyword.trim());
		// The scope rides with the keyword and is left off without one: alone it
		// cannot change what is on screen, and a link carrying it would differ
		// from one that does not while showing the same thing.
		if (filters.keyword_scope !== fallback.filters.keyword_scope) {
			params.set('keyword_scope', filters.keyword_scope);
		}
	}
	for (const [key, tokens] of Object.entries(filters.survey)) {
		for (const token of tokens) params.append('survey', `${key}=${token}`);
	}
	for (const [key, [low, high]] of Object.entries(filters.survey_ranges)) {
		params.append('survey_range', `${key}=${low}..${high}`);
	}

	if (state.listOrder !== fallback.listOrder) params.set('sort', state.listOrder);
	if (state.listGrouping !== fallback.listGrouping) params.set('group', state.listGrouping);

	if (state.groupMode !== fallback.groupMode) params.set('colour', state.groupMode);
	if (state.projection !== fallback.projection) params.set('projection', state.projection);
	// The two UMAP knobs mean nothing under PCA, so a PCA link does not carry
	// them — a URL should not describe controls the view it opens does not show.
	if (state.projection === 'umap') {
		if (state.nNeighbors !== fallback.nNeighbors) {
			params.set('neighbours', String(state.nNeighbors));
		}
		if (state.minDist !== fallback.minDist) params.set('min_dist', String(state.minDist));
	}
	if (state.minClusterSize !== fallback.minClusterSize) {
		params.set('min_cluster', String(state.minClusterSize));
	}
	if (state.centerByQuestion !== fallback.centerByQuestion) {
		params.set('centre_question', state.centerByQuestion ? '1' : '0');
	}
	if (state.centerByLanguage !== fallback.centerByLanguage) {
		params.set('centre_language', state.centerByLanguage ? '1' : '0');
	}
	for (const code of state.visibleLanguages) params.append('show', code);

	return params;
}

/**
 * The cluster request a link asks for.
 *
 * Here rather than in the component because `load` needs it too: a link to a
 * filtered map should preload the map it links to, and the load function runs
 * before any component exists to ask.
 */
export function clusterSettingsOf(state: ExploreUrlState): ClusterSettings {
	return {
		kind: state.kind,
		projection: state.projection,
		n_neighbors: state.nNeighbors,
		min_dist: state.minDist,
		min_cluster_size: state.minClusterSize,
		center_by_question: state.centerByQuestion,
		center_by_language: state.centerByLanguage,
		filters: state.filters
	};
}

/** The query string, with the `?` and empty for a view at its defaults. */
export function exploreUrlSearch(state: ExploreUrlState): string {
	const params = exploreUrlParams(state).toString();
	return params ? `?${params}` : '';
}
