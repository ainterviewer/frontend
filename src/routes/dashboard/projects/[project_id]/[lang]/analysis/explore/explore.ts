import type {
	EmbeddingClusterPoint,
	EmbeddingGroup,
	EmbeddingKind,
	GroupKind,
	InterviewStatus,
	LanguageCode,
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
		value: 'message',
		label: 'Messages',
		hint: 'One respondent message of free text. Short, but grouped by what was said rather than what was asked.'
	},
	{
		value: 'qa_pair',
		label: 'Q&A pairs',
		hint: 'A main question, its answer, and every probe that followed. The unit most analysis wants.'
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
 * How many hits one page of a ranked list holds, for both search and
 * neighbours.
 *
 * Both endpoints take `limit`/`offset` and report a `total`, so the list on
 * screen is the first screen of a ranked scan rather than the whole of it. Ten
 * is what fits the panel without scrolling past the point where the scores
 * stop meaning much; the tail is a page away for a reader who wants it.
 *
 * `total` counts everything that scored, which is not the same as everything
 * worth reading — the bottom of a ranked scan is whatever scored least. That
 * is what the score cut-off is for, and why paging stops offering more once
 * the list has dropped below it.
 */
export const PAGE_SIZE = 10;

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

/** Bounds the API enforces on `min_cluster_size`, checked here so 422 is never
 * the first feedback. */
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
 * Language is a cohort here and nothing to do with the `[lang]` in the route,
 * which is the language the *guide* is being authored in. An empty list means
 * every language, which is the default: the report page pools them all for the
 * same reason, and each hit carries its own language for a reader who only
 * needs to tell them apart rather than to exclude one.
 *
 * Filtering here is a different act from hiding a language on the map. This
 * one changes what is embedded into the projection, so the axes, the clusters
 * and every purity figure are computed over the narrowed corpus — which is the
 * point, and also why it costs a refetch. `visibleLanguages` on the page is the
 * cheap half: same projection, some points dimmed.
 */
export type ExploreFilters = {
	status: InterviewStatus | null;
	languages: LanguageCode[];
	include_synthetic: boolean;
	/**
	 * Which places in the interview guide the chunks are drawn from, as
	 * `[section, main_question]` pairs — the same coordinates the annotate view
	 * filters messages with, so a question means the same thing in both places.
	 * An empty list is every question, which is the default.
	 *
	 * A whole section is asked for by listing its questions rather than by a
	 * second section-shaped filter: the picker holds the guide and so knows what
	 * a section contains, and one shape of filter cannot disagree with itself.
	 *
	 * Interview-level chunks carry no guide coordinates — a transcript spans the
	 * guide — so any selection here excludes them outright. That is why the
	 * control is not offered under the `interview` unit rather than offered and
	 * quietly returning nothing.
	 */
	questions: [number, number][];
	/**
	 * What the chunk's respondent messages must say, empty for no keyword
	 * filter.
	 *
	 * A boolean query rather than a string to look for — `dog OR cat`,
	 * `kids -school`, `(dog OR cat) AND "my neighbour"` — parsed by
	 * `keywordQuery.ts` here and by `app/db/keyword_query.py` there. Terms match
	 * whole words, case-insensitively, with `*` to open an edge.
	 *
	 * A filter and not a query, which is the whole design of the two searches:
	 * this narrows the candidate set in SQL, and the semantic query then ranks
	 * whatever survived. Enter only a keyword and you get a filtered list; only
	 * a query and you get today's semantic search; both, and you get "passages
	 * about X that literally say Y" — which is usually the question worth
	 * asking, and one neither search can answer alone.
	 *
	 * Matched against the respondent's own messages rather than the chunk text,
	 * because a chunk restates the question it answers: matching the rendering
	 * would let a word the interviewer said count as a word somebody answered.
	 */
	keyword: string;
	/**
	 * Which side of the exchange a bare term is matched against. `q:`/`a:` in
	 * the query override it for one term, which is how a scope no single control
	 * can express — "asked about X, answered Y" — gets written.
	 */
	keyword_scope: KeywordScope;
	/**
	 * Which survey answers the interviews behind the chunks must hold, keyed by
	 * the coordinate of the item they answer.
	 *
	 * A *cohort* filter: it selects interviews and then keeps everything they
	 * said, so "Male" here does not mean "show me the answers that say Male" —
	 * it means "show me what the men talked about". Values within one item are
	 * OR-ed and items are AND-ed, which is what a checklist per item reads as.
	 *
	 * Values are stored in the spelling the API takes them in: `option:1` for
	 * the second option of the item, `text:kayaking` for a write-in. Position
	 * rather than text because the same item asked in two languages offers the
	 * same choices translated — filtering on "Female" would silently drop
	 * everyone interviewed in Danish. `SurveyFacetValue.option` is the number.
	 */
	survey: SurveySelection;
	/**
	 * The same filter for the items whose answers are ordered rather than
	 * chosen — numbers, dates, times — as `[low, high]` in the item's own
	 * spelling. Either side may be empty for an open end.
	 */
	survey_ranges: SurveyRanges;
};

/**
 * Chosen survey values, keyed by `section,main_question` — the same spelling
 * the question filter writes, so one coordinate reads the same everywhere.
 */
export type SurveySelection = Record<string, string[]>;

/** A `[low, high]` pair per item, either side empty for an open end. */
export type SurveyRanges = Record<string, [string, string]>;

/** The wire spelling of one chosen value. */
export function surveyValueToken(option: number | null | undefined, label: string) {
	return option === null || option === undefined ? `text:${label}` : `option:${option}`;
}

/** Whether a value is currently chosen. */
export function hasSurveyValue(selection: SurveySelection, key: string, token: string) {
	return (selection[key] ?? []).includes(token);
}

/**
 * One value added or removed.
 *
 * An item left with nothing chosen is dropped rather than kept as an empty
 * list: an item filtering on no values is not a filter, and leaving the key
 * behind would make "any survey filter applied" true forever after the first
 * click.
 */
export function toggleSurveyValue(
	selection: SurveySelection,
	key: string,
	token: string
): SurveySelection {
	const current = selection[key] ?? [];
	const next = current.includes(token)
		? current.filter((other) => other !== token)
		: [...current, token];
	const { [key]: _dropped, ...rest } = selection;
	return next.length > 0 ? { ...rest, [key]: next } : rest;
}

/**
 * A range set, or cleared where both ends are empty.
 *
 * Both ends open is every answer, which is what no filter looks like — and a
 * range nothing can fail should not count as one, or the reset badge would
 * offer a way back from a filter that is not applied.
 */
export function setSurveyRange(
	ranges: SurveyRanges,
	key: string,
	low: string,
	high: string
): SurveyRanges {
	const { [key]: _dropped, ...rest } = ranges;
	return low.trim() || high.trim() ? { ...rest, [key]: [low.trim(), high.trim()] } : rest;
}

/** How many items the survey filter narrows by, for the chips and the badge. */
export function surveyItemCount(filters: ExploreFilters) {
	return new Set([...Object.keys(filters.survey), ...Object.keys(filters.survey_ranges)]).size;
}

/** Whether two survey selections ask for the same thing. */
export function sameSurvey(a: ExploreFilters, b: ExploreFilters) {
	const values = (selection: SurveySelection) =>
		Object.entries(selection)
			.map(([key, tokens]) => `${key}=${[...tokens].sort().join('|')}`)
			.sort()
			.join(';');
	const ranges = (all: SurveyRanges) =>
		Object.entries(all)
			.map(([key, [low, high]]) => `${key}=${low}..${high}`)
			.sort()
			.join(';');
	return (
		values(a.survey) === values(b.survey) && ranges(a.survey_ranges) === ranges(b.survey_ranges)
	);
}

/** Answers, the interviewer's questions, or either. */
export type KeywordScope = 'answer' | 'question' | 'both';

export function defaultFilters(): ExploreFilters {
	return {
		status: null,
		languages: [],
		include_synthetic: false,
		questions: [],
		keyword: '',
		keyword_scope: 'answer',
		survey: {},
		survey_ranges: {}
	};
}

/** Whether two question selections hold the same pairs, order aside. */
export function sameQuestions(a: [number, number][], b: [number, number][]) {
	return (
		a.length === b.length &&
		a.every(([section, question]) =>
			b.some(([other, otherQuestion]) => other === section && otherQuestion === question)
		)
	);
}

/** Whether a selection already holds one pair. */
export function hasQuestion(selected: [number, number][], section: number, question: number) {
	return selected.some(([s, q]) => s === section && q === question);
}

/**
 * One question added or removed, kept in guide order so the chips under the
 * picker read down the guide rather than in the order they were clicked.
 */
export function toggleQuestion(
	selected: [number, number][],
	section: number,
	question: number
): [number, number][] {
	const next = hasQuestion(selected, section, question)
		? selected.filter(([s, q]) => !(s === section && q === question))
		: [...selected, [section, question] as [number, number]];
	return sortQuestions(next);
}

/**
 * A whole section added or removed at once. Selecting is all-or-nothing on the
 * questions the section actually has, so a section that is already fully
 * selected clears rather than duplicating itself.
 */
export function toggleSection(
	selected: [number, number][],
	section: number,
	questionCount: number
): [number, number][] {
	const indices = Array.from({ length: questionCount }, (_, index) => index);
	const whole = indices.every((question) => hasQuestion(selected, section, question));
	if (whole) return selected.filter(([s]) => s !== section);

	const missing = indices
		.filter((question) => !hasQuestion(selected, section, question))
		.map((question) => [section, question] as [number, number]);
	return sortQuestions([...selected, ...missing]);
}

/** Guide order: by section, then by question within it. */
function sortQuestions(questions: [number, number][]): [number, number][] {
	return [...questions].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

/**
 * The wire spelling of a guide coordinate, `section,main_question`, zero-based.
 * Matches the `?question=` parameter the annotate view already writes, and the
 * pair the API parses.
 */
export function questionParam([section, question]: [number, number]) {
	return `${section},${question}`;
}

/**
 * The filter half of a request, with `null` status and an empty language list
 * left off entirely — the API reads a missing `language` as "every one", and
 * sending `[]` would be a request for none.
 */
/**
 * The filters the cohort picker's own counts are read under.
 *
 * Everything that selects *interviews*, and nothing that selects chunks: the
 * keyword and question filters are left off because the endpoint ignores them
 * — a facet counts people, and "interviews holding a matching chunk" is a
 * different unit — and because a picker that renumbered itself on every
 * keystroke in the keyword box would be unreadable.
 */
export function cohortQuery(filters: ExploreFilters) {
	const { keyword, keyword_scope, question, ...rest } = filterQuery(filters);
	// Referenced so the destructuring reads as the removal it is rather than as
	// three unused names.
	void keyword;
	void keyword_scope;
	void question;
	return rest;
}

/** Whether a cohort query asks for anything the preloaded one did not. */
export function isWholeCorpus(query: ReturnType<typeof cohortQuery>) {
	const { include_synthetic, ...narrowing } = query;
	return include_synthetic === false && Object.keys(narrowing).length === 0;
}

export function filterQuery(filters: ExploreFilters) {
	return {
		...(filters.status ? { status: filters.status } : {}),
		...(filters.languages.length > 0 ? { language: filters.languages } : {}),
		...(filters.questions.length > 0 ? { question: filters.questions.map(questionParam) } : {}),
		// Left off entirely when blank: sending `keyword=''` would be a request
		// for chunks containing nothing.
		// The scope rides with the keyword and is left off without one: alone it
		// cannot change an answer, and sending it would be one more reason to
		// refetch that changes nothing.
		...(filters.keyword.trim()
			? { keyword: filters.keyword.trim(), keyword_scope: filters.keyword_scope }
			: {}),
		// One parameter per chosen value and per range, each carrying the
		// coordinate it applies to: `?survey=0,2=option:1`. Left off entirely
		// when nothing is chosen, like every other filter here.
		...(Object.keys(filters.survey).length > 0
			? {
					survey: Object.entries(filters.survey).flatMap(([key, tokens]) =>
						tokens.map((token) => `${key}=${token}`)
					)
				}
			: {}),
		...(Object.keys(filters.survey_ranges).length > 0
			? {
					survey_range: Object.entries(filters.survey_ranges).map(
						([key, [low, high]]) => `${key}=${low}..${high}`
					)
				}
			: {}),
		include_synthetic: filters.include_synthetic
	};
}

/**
 * What a paged list of hits needs to describe itself and ask for more.
 *
 * Both ranked lists on this page — a search and a chunk's neighbours — are
 * pages of a scan the server counted in full, and both are read through the
 * same score cut-off. The panel renders them the same way, so it is handed the
 * same shape rather than seven parallel props twice over.
 */
export type ListPaging = {
	/** Hits fetched so far, cut-off aside. */
	loaded: number;
	/** Everything that scored, or null where the server did not say. */
	total: number | null;
	/** Of the fetched hits, how many the cut-off is holding back. */
	hiddenByCutoff: number;
	/**
	 * Whether more is worth offering. False once the list has reached `total`,
	 * and false once its tail has dropped below the cut-off — everything after
	 * that scored less again, so a further page would arrive already hidden.
	 */
	more: boolean;
	moreLoading: boolean;
	/**
	 * A page that failed on its own. Kept apart from the list's error because
	 * this one leaves what is already on screen perfectly good.
	 */
	moreError: string | null;
	onmore: () => void;
};

/** Whether two language selections hold the same codes, order aside. */
export function sameLanguages(a: LanguageCode[], b: LanguageCode[]) {
	return a.length === b.length && a.every((code) => b.includes(code));
}

/** One code added or removed, kept in the order `languages` lists them. */
export function toggleLanguage(
	selected: LanguageCode[],
	code: LanguageCode,
	order: LanguageCode[]
) {
	const next = selected.includes(code)
		? selected.filter((other) => other !== code)
		: [...selected, code];
	return order.filter((other) => next.includes(other));
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
 * The two language settings count only where they do anything: a monolingual
 * project would otherwise wear a badge for controls it is not shown and could
 * not change.
 */
export function offDefaultCount(settings: ClusterSettings, multilingual: boolean, listing = false) {
	const fallback = defaultClusterSettings();
	// The layout and clustering knobs are not shown in the list, so they are not
	// counted there either: a badge for controls the reader cannot see is a
	// promise of something to find that is not there.
	const mapping = !listing;
	return [
		mapping && settings.projection !== fallback.projection,
		mapping && settings.projection === 'umap' && settings.n_neighbors !== fallback.n_neighbors,
		mapping && settings.projection === 'umap' && settings.min_dist !== fallback.min_dist,
		mapping && settings.min_cluster_size !== fallback.min_cluster_size,
		mapping && settings.center_by_question !== fallback.center_by_question,
		mapping && multilingual && settings.center_by_language !== fallback.center_by_language,
		settings.filters.status !== fallback.filters.status,
		multilingual && settings.filters.languages.length > 0,
		settings.filters.questions.length > 0,
		settings.filters.keyword.trim().length > 0,
		// One, however many items are chosen: the badge counts controls a
		// reader has moved, and the survey filter is one control to open.
		surveyItemCount(settings.filters) > 0,
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
		sameLanguages(settings.filters.languages, fallback.filters.languages) &&
		sameQuestions(settings.filters.questions, fallback.filters.questions) &&
		settings.filters.keyword.trim() === fallback.filters.keyword &&
		sameSurvey(settings.filters, fallback.filters) &&
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
