<script lang="ts">
	import { page } from '$app/state';
	import { Analysis } from '$lib/api';
	import type {
		EmbeddingBrowseResponse,
		EmbeddingClusterPoint,
		EmbeddingClusterResponse,
		EmbeddingKind,
		EmbeddingSearchHit,
		EmbeddingSearchResponse,
		EmbeddingSimilarResponse,
		EmbeddingStatus,
		GroupKind,
		InterviewGuide,
		LanguageCode,
		ProjectLanguage,
		SurveyFacet
	} from '$lib/api/types.gen';
	import HoverInfo from '$lib/components/HoverInfo.svelte';
	import { OUTLIER_COLOR, mapColor } from '$lib/config/chartColors';
	import { format } from 'd3-format';
	import type { PageData } from './$types';
	import DetailPanel from './DetailPanel.svelte';
	import ControlRail from './ControlRail.svelte';
	import KeywordInput from './KeywordInput.svelte';
	import ListView from './ListView.svelte';
	import TranscriptModal from './TranscriptModal.svelte';
	import { ExploreState, type ExploreView } from './exploreState.svelte';
	import ScatterPlot from './ScatterPlot.svelte';
	import SweepBar from './SweepBar.svelte';
	import StatusStrip from './StatusStrip.svelte';
	import {
		DEFAULT_GROUP_MODE,
		DEFAULT_TASK,
		GROUP_MODES,
		MIN_CLUSTER_SIZE_RANGE,
		PAGE_SIZE,
		clusterQuery,
		cohortQuery,
		describeError,
		filterQuery,
		groupKeyOf,
		groupOrder,
		isDefaultClusterSettings,
		isToolbarChange,
		isWholeCorpus,
		offDefaultCount,
		type ClusterSettings,
		type ListPaging
	} from './explore';

	let { data }: { data: PageData } = $props();

	/** One option in the language controls. `count` is null until status lands. */
	type ExploreLanguage = { code: LanguageCode; name: string; count: number | null };

	const formatNumber = format(',');
	const formatPercent = format('.0%');

	// Backfill is an editor's action, and the server will refuse it from anyone
	// else — so the button is not offered to anyone else either. Absent
	// permissions mean the least rights, never the most.
	let canBackfill = $derived(
		['editor', 'admin'].includes(page.data.permissions?.role ?? '') ||
			(page.data.permissions?.is_owner ?? false)
	);

	let status = $state<EmbeddingStatus | null>(null);
	let statusError = $state<string | null>(null);

	/**
	 * Every knob both views read, and the view toggle itself.
	 *
	 * Shared deliberately: the map and the list are two renderings of one query,
	 * so switching between them must never quietly change which chunks are in
	 * play. The page keeps the fetching — the debounce and preload
	 * reconciliation below are intricate enough that two copies of them would
	 * be two things to get wrong — and the state module keeps the knobs.
	 */
	const explore = new ExploreState();

	// Local aliases for the few read in a dozen places each. Everything else is
	// spelled `explore.x` at its use site, which is where it reads best.
	let kind = $derived(explore.kind);
	let filters = $derived(explore.filters);
	let settings = $derived(explore.settings);
	let listing = $derived(explore.view === 'list');

	let clusters = $state<EmbeddingClusterResponse | null>(null);
	let clusterLoading = $state(true);
	let clusterError = $state<string | null>(null);

	// The box holds what is being typed; `submitted` holds what was searched
	// for. Kept apart because a semantic search costs an inference call — this
	// is not a filter box that narrows a list on every keystroke, and pretending
	// it is would put a request behind every letter.
	let queryText = $state('');
	let submitted = $state('');
	/**
	 * The envelope of the most recent page — the query it was run for, how many
	 * chunks were scored, how many there are in all. The hits themselves are
	 * held separately because they accumulate: a second page is appended to the
	 * list rather than swapped in for it, so a ranked list is read downwards
	 * the way it is written.
	 */
	let searchResponse = $state<EmbeddingSearchResponse | null>(null);
	let searchHits = $state<EmbeddingSearchHit[]>([]);
	let searchLoading = $state(false);
	let searchError = $state<string | null>(null);
	let searchMoreLoading = $state(false);
	let searchMoreError = $state<string | null>(null);

	/**
	 * The score below which a hit is not shown, applied to whichever ranked list
	 * is on screen — search results and a chunk's neighbours are the same cosine
	 * measure, so one control covers both.
	 *
	 * Applied here rather than sent to the server. The score is a real cosine
	 * value, so the reader can judge it — but only once they have seen the
	 * numbers the query actually produced, and re-running the search to drop
	 * three rows would cost another inference call for nothing.
	 */
	let scoreCutoff = $state(0);

	/**
	 * The chunk whose interview is open in the transcript dialog, or null.
	 *
	 * The hit and not its id: the dialog needs the coordinates to find the place
	 * in the transcript and the participant to title itself, and every one of
	 * those is already on the card the reader clicked. Held here rather than in
	 * the list, because the map's detail panel opens the same dialog and there is
	 * only ever one of them on screen.
	 */
	let transcriptOf = $state<EmbeddingSearchHit | null>(null);

	let selectedId = $state<string | null>(null);
	let detail = $state<EmbeddingSimilarResponse | null>(null);
	let detailHits = $state<EmbeddingSearchHit[]>([]);
	let detailLoading = $state(false);
	let detailError = $state<string | null>(null);
	let detailMoreLoading = $state(false);
	let detailMoreError = $state<string | null>(null);

	let focusedGroup = $state<string | null>(null);
	let hoveredId = $state<string | null>(null);

	/**
	 * Languages the reader is looking at, empty for all of them.
	 *
	 * Not part of `ClusterSettings`, and deliberately so: this is the same
	 * projection with some of it faded back, which costs a recolour rather than
	 * a request. `filters.languages` is the other half — it narrows the corpus
	 * before it is projected, so it moves every point and does cost one.
	 */
	let visibleLanguages = $state<LanguageCode[]>([]);

	// Open to begin with: a reader who has not seen this page before should not
	// have to find the controls, and the map has room for both at this width.
	let railOpen = $state(true);

	/**
	 * What the map is coloured by. Not part of `ClusterSettings`: all three
	 * groupings are read off one response — the clustering the server ran, and
	 * the guide coordinates it now returns per point — so switching costs a
	 * recolour rather than a request.
	 */
	let groupMode = $state<GroupKind>(DEFAULT_GROUP_MODE);

	/**
	 * How many chunks of the current unit are embedded, from the status call —
	 * which lands well before the clustering does, so the wait can say what it is
	 * waiting on. Null until it arrives, and the copy does without it.
	 */
	let embeddedCount = $derived(status?.coverage?.[kind] ?? null);

	/** Text search is the one thing here that needs the inference server. */
	/**
	 * Nothing in this project has been indexed.
	 *
	 * Distinct from the server being unreachable: the server is fine, there is
	 * simply nothing stored to compare against. Everything that reads vectors —
	 * the map, semantic search, nearest neighbours — has nothing to work with;
	 * everything that reads message rows still does, which is the whole list
	 * view. So this narrows the page rather than replacing it.
	 */
	let unindexed = $derived(status !== null && (status.total ?? 0) === 0);

	// Healthy is not enough: the query would be embedded successfully and then
	// compared against an empty corpus, which is a blank result with no reason
	// attached rather than an answer.
	let searchAvailable = $derived((status?.healthy ?? false) && !unindexed);

	/**
	 * The languages the two language controls offer.
	 *
	 * Never read from the plotted points, which are whatever the current unit
	 * and filters returned: a filter built on those would delete its own options
	 * the moment it was used — pick Danish, and English is no longer on offer to
	 * pick back.
	 *
	 * The project's own localizations are the list at first paint. They come
	 * down with the layout load, so they are here before this component is, and
	 * the controls are on screen from the first frame rather than appearing a
	 * beat later when a request answers. They also carry real names, which two
	 * letters do not.
	 *
	 * The status call adds the counts when it lands, and appends any language
	 * the corpus holds that the project no longer declares — a localization can
	 * be removed after interviews were run in it, and a list that claims to be
	 * complete has to say so. It does not take options away: a language nobody
	 * was interviewed in stays on offer, reading `0`, which is a more useful
	 * thing to be told than a chip that quietly never existed.
	 *
	 * The project's order is kept for the same reason it is the source: it is
	 * fixed and alphabetical, so the chips do not rearrange themselves under the
	 * pointer when the counts arrive.
	 */
	// `page.data` is loosely typed at this depth, so the shape is stated here.
	let projectLanguages = $derived<ProjectLanguage[]>(page.data.project?.available_languages ?? []);

	let languages = $derived.by((): ExploreLanguage[] => {
		const counts = status
			? new Map(
					// The generated type makes every language key optional, so an
					// entry's count reads as possibly undefined even though the
					// server only ever writes one where it has a number. Coalescing
					// here keeps the map's value type `number`, which is what the
					// sort and the chip counts below want.
					Object.entries(status.languages ?? {}).map(([code, count]): [string, number] => [
						code.toUpperCase(),
						count ?? 0
					])
				)
			: null;

		const declared = projectLanguages.map((language) => ({
			code: language.code,
			name: language.name,
			// Null while the status is still out — the project knows its
			// languages, not how much of each is embedded — and 0 once it has
			// answered and had nothing to say about this one.
			count: counts ? (counts.get(language.code.toUpperCase()) ?? 0) : null
		}));

		if (!counts) return declared;

		const known = new Set(declared.map((language) => language.code.toUpperCase()));
		const undeclared = [...counts]
			.filter(([code]) => !known.has(code))
			.sort(([, a], [, b]) => b - a)
			.map(([code, count]) => ({ code, name: code, count }));

		return [...declared, ...undeclared];
	});

	// -- status ---------------------------------------------------------------

	$effect(() => {
		// `load` has already asked, and asks again on every navigation, so there
		// is never a second request to send from here. The strip below hands its
		// own refreshed status back up while a backfill drains.
		const request = data.status;

		let disposed = false;
		(async () => {
			const { data: body, error, response } = await request;
			if (disposed) return;
			if (error || !body) {
				statusError = describeError(response?.status, 'Could not read the embedding status.');
				return;
			}
			status = body;
			statusError = null;
		})();

		return () => {
			disposed = true;
		};
	});

	// -- guide ----------------------------------------------------------------

	/**
	 * The interview guide, for the question filter's option list.
	 *
	 * Its failure is deliberately quiet: the guide is one control's list of
	 * options, not the page. If it never lands the rail simply does not offer a
	 * question filter, and everything the map does is unaffected — an error
	 * banner over a working scatter would be reporting a problem the reader
	 * cannot act on and did not ask about.
	 */
	let guide = $state<InterviewGuide | null>(null);

	$effect(() => {
		const request = data.guide;

		let disposed = false;
		(async () => {
			const { data: body } = await request;
			if (disposed) return;
			guide = body ?? null;
		})();

		return () => {
			disposed = true;
		};
	});

	/**
	 * The survey items the cohort filter offers, or null while they load.
	 *
	 * Null hides the control, exactly as a missing guide hides the question
	 * filter: a project whose interviews carry no survey items has nothing to
	 * offer here, and an empty picker would be a promise of something to find.
	 */
	let surveyFacets = $state<SurveyFacet[] | null>(null);

	/**
	 * Re-read whenever the cohort changes.
	 *
	 * The items and their options come back the same every time — they describe
	 * the project — but the counts beside them are of the interviews currently
	 * in view, and a picker reading "62 male" beside a list drawn from 52
	 * interviews reads as one of the two numbers being wrong. Each item is
	 * exempt from its own selection, so choosing an option never collapses the
	 * options beside it; that is the server's rule, not this one's.
	 *
	 * The preloaded request is reused whenever nothing is narrowing the corpus,
	 * which is exactly what it asked for — including on the way back, after a
	 * reader clears their filters.
	 */
	$effect(() => {
		const projectId = data.project_id;
		const query = cohortQuery(filters);
		const preloaded = data.surveyFacets;

		let disposed = false;
		(async () => {
			const { data: body } = isWholeCorpus(query)
				? await preloaded
				: await Analysis.readSurveyFacets({ path: { project_id: projectId }, query });
			if (disposed) return;
			// Left standing on failure rather than blanked: the picker's options
			// are still the project's options, and a control that vanished
			// because its counts could not be refreshed would take the reader's
			// current selection with it.
			if (body) surveyFacets = body.items ?? null;
		})();

		return () => {
			disposed = true;
		};
	});

	// -- clusters -------------------------------------------------------------

	/**
	 * How long to sit on a settings change before asking.
	 *
	 * A drag across a slider track emits a value per pixel, and every one of
	 * those is a request the reader has already moved past. PCA recomputes in
	 * around 200 ms, which is what makes the toolbar's controls sliders rather
	 * than form fields; UMAP is seconds, so it waits longer before committing.
	 *
	 * The tuning panel waits longer still. Nothing in it is dragged to explore —
	 * it is opened, adjusted, and closed — so the only thing a short wait buys
	 * there is UMAP runs for the values passed through on the way.
	 */
	const TOOLBAR_DEBOUNCE_MS = { pca: 250, umap: 500 } as const;
	const PANEL_DEBOUNCE_MS = 800;

	let clusterProjectId: string | null = null;
	let seenClusterPreload: PageData['clusters'] | null = null;
	// Deliberately not `$state`: this only ever decides how long the next
	// request waits, and making it reactive would re-run the effect that sets it.
	let lastClusterSettings: ClusterSettings | null = null;

	$effect(() => {
		const projectId = data.project_id;
		const preloaded = data.clusters;
		const query = clusterQuery(settings);

		// Never show one project's map as if it were another's. A settings change
		// within a project keeps the current scatter up until the recompute lands,
		// since it is the same corpus either way.
		if (clusterProjectId !== projectId) {
			clusterProjectId = projectId;
			clusters = null;
			clusterError = null;
		}

		// Nothing in the list reads a cluster, and UMAP is seconds of server CPU
		// per run — so typing a keyword while listing would refit a projection
		// for a scatter nobody is looking at, once per debounced keystroke. The
		// last map stays in memory rather than being cleared: the filters that
		// produced it are still the current ones, so switching back to the map
		// shows it immediately and the effect re-runs from here to catch up on
		// anything that changed meanwhile.
		if (listing) {
			clusterLoading = false;
			return;
		}

		// Below the return on purpose. The page opens on the list, so the first
		// run of this effect is a run that draws nothing — and stamping the
		// preload there would mark it seen without anyone having looked at it,
		// leaving the first switch to the map to refit a projection the load
		// function had already asked for. Same for the debounce: a settings
		// change made while listing is the reader arriving at the map with it,
		// not flicking a control on it.
		const adopting = preloaded !== seenClusterPreload && isDefaultClusterSettings(settings);
		seenClusterPreload = preloaded;

		const fromToolbar = isToolbarChange(lastClusterSettings, settings);
		lastClusterSettings = settings;

		clusterLoading = true;
		let disposed = false;
		const controller = new AbortController();

		// The preloaded request went out before this component existed and has no
		// signal to abort, so it is never delayed and never cancelled — only
		// discarded if the reader has moved on by the time it lands.
		const timer = setTimeout(
			async () => {
				const request = adopting
					? preloaded
					: Analysis.clusterEmbeddings({
							path: { project_id: projectId },
							query,
							signal: controller.signal
						});

				const { data: body, error, response } = await request;
				if (disposed) return;

				clusterLoading = false;
				if (error || !body) {
					// A failed recompute after a slider nudge leaves the previous map
					// up; only a page with nothing on it gets an error in its place.
					if (!clusters) clusterError = describeError(response?.status, 'Could not cluster.');
					return;
				}

				clusters = body;
				clusterError = null;
			},
			adopting ? 0 : fromToolbar ? TOOLBAR_DEBOUNCE_MS[query.projection] : PANEL_DEBOUNCE_MS
		);

		return () => {
			disposed = true;
			clearTimeout(timer);
			controller.abort();
		};
	});

	// -- search ---------------------------------------------------------------

	/**
	 * Which request a page belongs to.
	 *
	 * "Load more" runs outside the effect that owns the search, so it has no
	 * abort signal to be cancelled by. The counter is what a late page checks
	 * itself against before appending to a list that has since been replaced by
	 * a different query, unit or filter.
	 */
	let searchRun = 0;

	$effect(() => {
		const projectId = data.project_id;
		const query = submitted.trim();
		const currentKind = kind;
		const currentFilters = filterQuery(filters);

		searchRun += 1;
		searchMoreLoading = false;
		searchMoreError = null;

		if (!query) {
			searchResponse = null;
			searchHits = [];
			searchError = null;
			searchLoading = false;
			return;
		}

		searchLoading = true;
		let disposed = false;
		const controller = new AbortController();

		(async () => {
			const {
				data: body,
				error,
				response
			} = await Analysis.searchEmbeddings({
				path: { project_id: projectId },
				query: {
					query,
					kind: currentKind,
					task: DEFAULT_TASK,
					limit: PAGE_SIZE,
					offset: 0,
					...currentFilters
				},
				signal: controller.signal
			});
			if (disposed) return;

			searchLoading = false;
			if (error || !body) {
				searchResponse = null;
				searchHits = [];
				searchError = describeError(response?.status, 'The search could not be run.');
				return;
			}

			searchResponse = body;
			searchHits = body.items ?? [];
			searchError = null;
		})();

		return () => {
			disposed = true;
			controller.abort();
		};
	});

	/**
	 * The next page of results, appended.
	 *
	 * Costs another inference call — the server re-embeds the query to score the
	 * next slice — which is the reason this is a button rather than something
	 * the scroller does on the reader's behalf.
	 */
	async function loadMoreSearch() {
		const query = submitted.trim();
		if (searchMoreLoading || !searchResponse || !query) return;

		const run = searchRun;
		searchMoreLoading = true;
		searchMoreError = null;

		const {
			data: body,
			error,
			response
		} = await Analysis.searchEmbeddings({
			path: { project_id: data.project_id },
			query: {
				query,
				kind,
				task: DEFAULT_TASK,
				limit: PAGE_SIZE,
				offset: searchHits.length,
				...filterQuery(filters)
			}
		});
		if (run !== searchRun) return;

		searchMoreLoading = false;
		if (error || !body) {
			// The list already on screen is untouched and still correct, so this
			// says so beside the button rather than replacing the results.
			searchMoreError = describeError(response?.status, 'Could not load more results.');
			return;
		}

		searchResponse = body;
		searchHits = [...searchHits, ...(body.items ?? [])];
	}

	// -- browsing -------------------------------------------------------------

	/**
	 * The list's resting state: the corpus in guide order, with no query behind
	 * it.
	 *
	 * Only fetched for the list, and only while nothing is being searched — a
	 * semantic query ranks the same filtered corpus, so the search above already
	 * answers that case and browsing it too would be a second request for a list
	 * nobody is looking at.
	 *
	 * Needs no vectors at all, which is the point: keyword search and structural
	 * filtering work on a project the day it finishes collecting, rather than
	 * after somebody remembers to run a backfill.
	 */
	let browseResponse = $state<EmbeddingBrowseResponse | null>(null);
	let browseHits = $state<EmbeddingSearchHit[]>([]);
	let browseLoading = $state(false);
	let browseError = $state<string | null>(null);
	let browseMoreLoading = $state(false);
	let browseMoreError = $state<string | null>(null);
	// The same guard as `searchRun`, and deliberately not `$state`: the effect
	// below both reads and writes it, which for reactive state is an effect that
	// retriggers itself until Svelte gives up with `effect_update_depth_exceeded`.
	// Nothing renders it either — it only ever decides whether a late page still
	// belongs to the list it was fetched for.
	let browseRun = 0;

	/** Whether a semantic query is ordering the list rather than the guide. */
	let ranked = $derived(submitted.trim().length > 0);

	$effect(() => {
		const projectId = data.project_id;
		const currentKind = kind;
		const currentFilters = filterQuery(filters);
		// Read here rather than at the call below, so changing the order refetches
		// — the list is ordered in SQL, and page one of a shuffle is not something
		// the client could re-derive from the page it is holding.
		const currentOrder = explore.listOrder;
		const wanted = listing && !ranked && selectedId === null;

		browseRun += 1;
		browseMoreLoading = false;
		browseMoreError = null;

		if (!wanted) {
			browseResponse = null;
			browseHits = [];
			browseError = null;
			browseLoading = false;
			return;
		}

		browseLoading = true;
		let disposed = false;
		const controller = new AbortController();

		(async () => {
			const {
				data: body,
				error,
				response
			} = await Analysis.browseEmbeddings({
				path: { project_id: projectId },
				query: {
					kind: currentKind,
					limit: PAGE_SIZE,
					offset: 0,
					order: currentOrder,
					seed: explore.seed,
					...currentFilters
				},
				signal: controller.signal
			});
			if (disposed) return;

			browseLoading = false;
			if (error || !body) {
				browseResponse = null;
				browseHits = [];
				browseError = describeError(response?.status, 'The corpus could not be read.');
				return;
			}

			browseResponse = body;
			browseHits = body.items ?? [];
			browseError = null;
		})();

		return () => {
			disposed = true;
			controller.abort();
		};
	});

	/** The next page, appended. Costs no inference: nothing here is scored. */
	async function loadMoreBrowse() {
		if (browseMoreLoading || !browseResponse) return;

		const run = browseRun;
		browseMoreLoading = true;
		browseMoreError = null;

		const {
			data: body,
			error,
			response
		} = await Analysis.browseEmbeddings({
			path: { project_id: data.project_id },
			query: {
				kind,
				limit: PAGE_SIZE,
				offset: browseHits.length,
				// The same seed as the page above it, so this continues that shuffle
				// rather than dealing a second one over the same corpus.
				order: explore.listOrder,
				seed: explore.seed,
				...filterQuery(filters)
			}
		});

		// The filters may have moved while this was in flight, in which case the
		// effect above has already replaced the list this was a page of.
		if (run !== browseRun) return;

		browseMoreLoading = false;
		if (error || !body) {
			browseMoreError = describeError(response?.status, 'That page could not be loaded.');
			return;
		}

		browseHits = [...browseHits, ...(body.items ?? [])];
	}

	// -- chunk detail ---------------------------------------------------------

	/** The same guard as `searchRun`, for the neighbours list. */
	let detailRun = 0;

	$effect(() => {
		const projectId = data.project_id;
		const id = selectedId;
		const currentFilters = filterQuery(filters);

		detailRun += 1;
		detailMoreLoading = false;
		detailMoreError = null;

		if (!id) {
			detail = null;
			detailHits = [];
			detailError = null;
			detailLoading = false;
			return;
		}

		detailLoading = true;
		let disposed = false;
		const controller = new AbortController();

		(async () => {
			// Costs no inference at all: the chunk's vector is already stored, so
			// this keeps working while the embedding server is down.
			const {
				data: body,
				error,
				response
			} = await Analysis.findSimilarEmbeddings({
				path: { project_id: projectId, embedding_id: id },
				query: { limit: PAGE_SIZE, offset: 0, ...currentFilters },
				signal: controller.signal
			});
			if (disposed) return;

			detailLoading = false;
			if (error || !body) {
				detail = null;
				detailHits = [];
				detailError = describeError(response?.status, 'Could not load this chunk.');
				return;
			}

			detail = body;
			detailHits = body.items ?? [];
			detailError = null;
		})();

		return () => {
			disposed = true;
			controller.abort();
		};
	});

	/** The next page of neighbours. Stored vectors, so this one is cheap. */
	async function loadMoreNeighbours() {
		const id = selectedId;
		if (detailMoreLoading || !detail || !id) return;

		const run = detailRun;
		detailMoreLoading = true;
		detailMoreError = null;

		const {
			data: body,
			error,
			response
		} = await Analysis.findSimilarEmbeddings({
			path: { project_id: data.project_id, embedding_id: id },
			query: { limit: PAGE_SIZE, offset: detailHits.length, ...filterQuery(filters) }
		});
		if (run !== detailRun) return;

		detailMoreLoading = false;
		if (error || !body) {
			detailMoreError = describeError(response?.status, 'Could not load more neighbours.');
			return;
		}

		detail = body;
		detailHits = [...detailHits, ...(body.items ?? [])];
	}

	// -- the score cut-off ----------------------------------------------------

	/** One cut-off, applied to whichever ranked list is being read. */
	function aboveCutoff(hits: EmbeddingSearchHit[]) {
		// A browsed row has no score at all and is never cut: the cut-off is a
		// statement about a ranking, and there is none behind it to read.
		return scoreCutoff <= 0
			? hits
			: hits.filter(
					(hit) => hit.score === null || hit.score === undefined || hit.score >= scoreCutoff
				);
	}

	/**
	 * Whether another page is worth offering.
	 *
	 * Two reasons it is not. The obvious one is that the list has reached what
	 * the server counted. The other is the cut-off: a ranked scan only goes
	 * down, so once the last hit fetched has fallen below the line, everything
	 * a further page could return would arrive already hidden — and a button
	 * whose only effect is to spend a request and change nothing on screen is
	 * worse than no button.
	 */
	function moreWorthOffering(hits: EmbeddingSearchHit[], total: number | null) {
		if (total === null || hits.length >= total) return false;
		const last = hits[hits.length - 1];
		if (!last || scoreCutoff <= 0) return true;
		return last.score === null || last.score === undefined || last.score >= scoreCutoff;
	}

	function paging(
		hits: EmbeddingSearchHit[],
		total: number | null | undefined,
		moreLoading: boolean,
		moreError: string | null,
		onmore: () => void
	): ListPaging {
		const counted = total ?? null;
		return {
			loaded: hits.length,
			total: counted,
			hiddenByCutoff: hits.length - aboveCutoff(hits).length,
			more: moreWorthOffering(hits, counted),
			moreLoading,
			moreError,
			onmore
		};
	}

	/** The results as the panel and the map see them: fetched, then filtered. */
	let visibleSearch = $derived.by((): EmbeddingSearchResponse | null =>
		searchResponse ? { ...searchResponse, items: aboveCutoff(searchHits) } : null
	);

	/**
	 * The neighbours, filtered the same way. `source` is never filtered — it is
	 * the chunk the reader anchored on, not a result they are ranking.
	 */
	let visibleDetail = $derived.by((): EmbeddingSimilarResponse | null =>
		detail ? { ...detail, items: aboveCutoff(detailHits) } : null
	);

	let searchPaging = $derived(
		paging(searchHits, searchResponse?.total, searchMoreLoading, searchMoreError, loadMoreSearch)
	);

	let browsePaging = $derived(
		paging(browseHits, browseResponse?.total, browseMoreLoading, browseMoreError, loadMoreBrowse)
	);

	let neighbourPaging = $derived(
		paging(detailHits, detail?.total, detailMoreLoading, detailMoreError, loadMoreNeighbours)
	);

	/**
	 * What the list shows, from whichever of three requests answers it.
	 *
	 * With an anchor it is that chunk's neighbours; with a query, the search
	 * endpoint's ranking of the filtered corpus; with neither, the browse
	 * endpoint's same corpus in guide order. One list in all three cases, so a
	 * reader narrows, searches and walks without ever crossing into a different
	 * screen — and the strip above it says which of the three they are reading,
	 * because the top of a ranking and the top of a corpus mean different things.
	 */
	let walking = $derived(listing && selectedId !== null);

	let listHits = $derived.by(() => {
		if (walking) return aboveCutoff(detailHits);
		return ranked ? aboveCutoff(searchHits) : browseHits;
	});
	let listTotal = $derived.by(() => {
		if (walking) return detail?.total ?? null;
		return ranked ? (searchResponse?.total ?? null) : (browseResponse?.total ?? null);
	});
	/**
	 * How many interviews the list is drawn from, as the server counted them.
	 *
	 * Server-side rather than counted over `listHits`, which is a page: a count
	 * of what is loaded climbs with every "Load more", and a reader watching a
	 * number go up reads that as the corpus growing rather than as their own
	 * scrolling. Null while nothing has come back, so the strip says nothing
	 * rather than saying zero.
	 */
	let listInterviews = $derived.by(() => {
		if (walking) return detail?.interviews ?? null;
		return ranked ? (searchResponse?.interviews ?? null) : (browseResponse?.interviews ?? null);
	});
	let listLoading = $derived(walking ? detailLoading : ranked ? searchLoading : browseLoading);
	let listError = $derived(walking ? detailError : ranked ? searchError : browseError);
	let listPaging = $derived(walking ? neighbourPaging : ranked ? searchPaging : browsePaging);

	/** The chunk being walked from, once its neighbours have landed. */
	let listAnchor = $derived(walking ? (detail?.source ?? null) : null);

	/** Neighbours carry a real similarity score, exactly as search hits do. */
	let listRanked = $derived(walking || ranked);

	/**
	 * Whether the cut-off has a list to act on. Tied to what was asked for
	 * rather than to what has come back, so the control does not appear a beat
	 * after the results and shift the row it sits in.
	 */
	let cutoffApplies = $derived(submitted.trim() !== '' || selectedId !== null);

	// -- map highlighting -----------------------------------------------------

	let points = $derived(clusters?.points ?? []);

	/**
	 * Which points the map should pick out, or `null` to leave every point at
	 * full strength. Search and a focused cluster share the mechanism because
	 * they are the same question asked twice — *where on the map is this?*
	 */
	let matchedIds = $derived.by((): Set<string> | null => {
		if (visibleSearch) {
			return new Set((visibleSearch.items ?? []).map((hit) => hit.id));
		}
		if (focusedGroup !== null) {
			return new Set(
				points.filter((p) => groupKeyOf(p, groupMode) === focusedGroup).map((p) => p.id)
			);
		}
		return null;
	});

	// -- grouping -------------------------------------------------------------

	let groups = $derived(clusters?.groups ?? []);

	/** Palette position per guide group; cluster ids are positions already. */
	let order = $derived(groupOrder(groups, groupMode));

	function colorOf(point: EmbeddingClusterPoint) {
		const key = groupKeyOf(point, groupMode);
		if (key === null) return OUTLIER_COLOR;
		return mapColor(groupMode === 'cluster' ? Number(key) : (order.get(key) ?? null));
	}

	function grouped(point: EmbeddingClusterPoint) {
		return groupKeyOf(point, groupMode) !== null;
	}

	function strengthOf(point: EmbeddingClusterPoint) {
		// Only HDBSCAN reports a membership probability. Guide membership is
		// recorded, not inferred, so every point in a question is equally in it —
		// fading them by a number that does not exist would invent a gradient.
		return groupMode === 'cluster' ? point.probability : 1;
	}

	let groupLabels = $derived(new Map(groups.map((group) => [group.key, group.label])));

	/**
	 * Whether the project holds more than one language.
	 *
	 * On a single-language project, colouring by language paints every point
	 * the same colour and the purity of every cluster is 1.0 — a control that
	 * can only ever say one thing, and a warning that can only ever be noise.
	 * So the mode, the badge and both language controls are offered only where
	 * they can distinguish.
	 *
	 * Asked of the project rather than of the plotted points, because the
	 * language filter is one of the things that decides what is plotted: read
	 * off the points, narrowing to Danish would remove the control that did the
	 * narrowing and strand the reader there.
	 */
	let multilingual = $derived(languages.length > 1);

	/** Whether a point is one of the languages currently on show. */
	function visible(point: EmbeddingClusterPoint) {
		return visibleLanguages.length === 0 || visibleLanguages.includes(point.language);
	}

	// Hiding a language and excluding it from the corpus are separate controls,
	// and set against each other they leave a map with nothing lit on it. The
	// filter wins: it is the one that says what the map is of.
	$effect(() => {
		const included = explore.filterLanguages;
		const shown = explore.visibleLanguages;
		if (included.length === 0 || shown.length === 0) return;
		const kept = shown.filter((code) => included.includes(code));
		if (kept.length !== shown.length) explore.visibleLanguages = kept;
	});

	/** Shared by the rail's reset button and the button that reopens the rail. */
	let offDefault = $derived(offDefaultCount(settings, multilingual, listing));

	let modes = $derived(GROUP_MODES.filter((mode) => mode.value !== 'language' || multilingual));

	// The status call is what says whether there is a second language, and it
	// lands after the first paint — so the mode can be gone by the time the
	// answer arrives, and a reader who got to it first would be left on a mode
	// whose button no longer exists.
	$effect(() => {
		if (groupMode === 'language' && !multilingual) changeGroupMode('cluster');
	});

	let modeLabel = $derived(
		GROUP_MODES.find((mode) => mode.value === groupMode)?.label ?? 'Clusters'
	);

	let groupCount = $derived(groups.filter((group) => group.kind === groupMode).length);
	// Chunks the guide cannot place: an interview-level chunk spans the whole
	// guide and carries no coordinates at all.
	let ungrouped = $derived(points.filter((point) => !grouped(point)).length);

	function describe(point: EmbeddingClusterPoint) {
		const key = groupKeyOf(point, groupMode);
		if (groupMode === 'cluster') {
			return key === null
				? 'Unplaced'
				: `Cluster ${key} · ${Math.round(point.probability * 100)}% member`;
		}
		if (key === null) return 'No guide coordinates';
		// A language key is a bare code and the API lists no group for it under
		// some filters; upper-casing it reads as a label either way.
		return groupLabels.get(key) ?? (groupMode === 'language' ? key.toUpperCase() : key);
	}

	// A key from one grouping means nothing under the next, and clustering knobs
	// that change what the clusters are invalidate a cluster focus outright.
	function changeGroupMode(next: GroupKind) {
		groupMode = next;
		focusedGroup = null;
	}

	$effect(() => {
		void explore.minClusterSize;
		void clusters;
		if (groupMode === 'cluster') focusedGroup = null;
	});

	/**
	 * The upper end of the slider, from the run on screen. A fixed maximum is
	 * either useless on a small project or unreachable on a large one; a quarter
	 * of the corpus is past the point where HDBSCAN has anything left to find.
	 */
	let maxClusterSize = $derived(
		Math.min(MIN_CLUSTER_SIZE_RANGE.max, Math.max(10, Math.floor((clusters?.n_points ?? 40) / 4)))
	);

	// A narrower filter can put the maximum below where the reader left the
	// slider, which leaves a control that looks stuck at the wrong number. The
	// write converges — it only ever lowers, and only while it is out of range.
	$effect(() => {
		if (explore.minClusterSize > maxClusterSize) explore.minClusterSize = maxClusterSize;
	});

	function search(event: SubmitEvent) {
		event.preventDefault();
		submitted = queryText;
		// A new query answers a different question than whatever chunk is open.
		selectedId = null;
		focusedGroup = null;
	}

	function clearSearch() {
		queryText = '';
		submitted = '';
		// The cut-off is left where the reader put it. It used to be reset here,
		// when it lived in a rail that could be collapsed over it and only ever
		// applied to a search; now it is in the search row, in sight, and it is
		// also what the neighbours list is being read through — clearing a query
		// is not a reason to move a control the reader can see and is still using.
	}

	// Ids belong to the run that produced them, so a change of kind invalidates
	// every selection made against the previous one.
	function changeKind(next: EmbeddingKind) {
		kind = next;
		selectedId = null;
		focusedGroup = null;
	}
</script>

<div class="flex min-h-0 flex-1 flex-col gap-3">
	<header>
		<h1 class="text-2xl font-semibold text-gray-800">Explore</h1>
		<!-- What the page is for, in one line and in every state. The controls
		     say what is available right now -- a disabled query box, an
		     unindexed map -- and a subtitle that also tried to would be two
		     things to keep true instead of one. It no longer says "by meaning
		     rather than by wording": keyword search is a real half of the page,
		     not the thing the page is an alternative to. -->
		<p class="mt-1 max-w-2xl text-sm text-gray-500">
			Search the transcripts by wording or by meaning, and see how the answers group.
		</p>
	</header>

	<!-- Only the two states the status *answers* gate the page. A status that has
	     not landed, or that failed, does not: it says whether text search is
	     available, and nothing else here depends on the inference server -- the
	     map and nearest-neighbours read stored vectors. Waiting on it put the
	     whole page behind a spinner whenever the embedding host was unreachable,
	     which is exactly when the parts that still work matter most. -->
	{#if status && !status.enabled}
		<!-- A normal state, not an error: embedding is configured per deployment
		     and off by default, and with it off the interviews run exactly as
		     they always did. Nothing here is broken and nothing is waiting. -->
		<div class="rounded-lg border border-gray-200 bg-white px-5 py-8 text-center">
			<p class="text-sm font-medium text-gray-700">Semantic search is not enabled here</p>
			<p class="mx-auto mt-1 max-w-md text-sm text-gray-500">
				This deployment does not run an embedding server, so transcripts are not indexed for
				meaning. Everything else about the project is unaffected.
			</p>
		</div>
	{:else}
		{#if status}
			<StatusStrip
				{status}
				projectId={data.project_id}
				{canBackfill}
				onstatus={(next) => (status = next)}
			/>
		{:else if statusError}
			<p class="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-xs text-gray-500">
				{statusError} Text search stays unavailable until it answers; the map and “nearest neighbours”
				read stored vectors and still work.
			</p>
		{:else}
			<div class="h-[2.375rem] animate-pulse rounded-lg bg-gray-100"></div>
		{/if}

		{#if status && !status.healthy}
			<p class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
				The embedding server is not reachable, so text search is unavailable. The map and “nearest
				neighbours” read stored vectors and still work.
			</p>
		{/if}

		<!-- Search stands alone above the map. It is what most readers come for,
		     and everything that shapes the map is in the rail beside it. -->
		<div
			class="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-gray-200 bg-white px-4 py-3"
		>
			<!-- The two readings of one query, and a toggle rather than two routes:
			     everything that decides which chunks are in play is shared, so
			     switching must not quietly change the corpus being looked at. -->
			<div
				role="group"
				aria-label="View"
				class="flex overflow-hidden rounded-md border border-gray-200"
			>
				{#each [{ value: 'list', label: 'List', icon: 'fa-list' }, { value: 'map', label: 'Map', icon: 'fa-diagram-project' }] as option (option.value)}
					<button
						type="button"
						onclick={() => (explore.view = option.value as ExploreView)}
						aria-pressed={explore.view === option.value}
						class="flex cursor-pointer items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium transition-colors {explore.view ===
						option.value
							? 'bg-primary text-on-primary'
							: 'bg-white text-gray-500 hover:text-gray-900'}"
					>
						<i class="fas {option.icon} text-[0.6875rem]"></i>
						{option.label}
					</button>
				{/each}
			</div>

			<form onsubmit={search} class="flex min-w-[18rem] flex-1 items-center gap-2">
				<div class="relative flex-1">
					<i
						class="fas fa-magnifying-glass pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-xs {searchAvailable
							? 'text-gray-300'
							: 'text-gray-400'}"
					></i>
					<input
						type="search"
						bind:value={queryText}
						disabled={!searchAvailable}
						placeholder={searchAvailable
							? 'How do people describe trust?'
							: unindexed
								? 'Needs indexing — see the map'
								: 'Needs the embedding server'}
						aria-label="Search the transcripts by meaning"
						class="w-full rounded-md border border-gray-200 py-1.5 pr-3 pl-8 text-sm placeholder:text-gray-300 focus:border-primary focus:ring-0 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400 disabled:placeholder:text-gray-400"
					/>
				</div>
				<button
					type="submit"
					disabled={!searchAvailable || !queryText.trim()}
					class="cursor-pointer rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-on-primary disabled:cursor-not-allowed disabled:opacity-50"
				>
					Search
				</button>
				{#if submitted}
					<button
						type="button"
						onclick={clearSearch}
						class="cursor-pointer text-sm text-gray-500 hover:text-gray-900"
					>
						Clear
					</button>
				{/if}
			</form>

			<!-- The cut-off sits with the query rather than in the rail, because it
			     is a property of the list of hits and not of the map: it filters
			     what came back, and the rail can be collapsed over it. It applies to
			     whichever ranked list the panel is showing — results, or a chunk's
			     neighbours — which is why it is out here rather than in either.

			     Between the two boxes because it belongs to the one above it: only
			     a semantic query or a walk produces a score to cut, and the keyword
			     box below is a filter with no score at all. Sitting past the keyword
			     box made it look like a third, unrelated control rather than the
			     dial on the search it qualifies. -->
			{#if cutoffApplies}
				<div class="flex items-center gap-2">
					<label for="score-cutoff" class="text-xs whitespace-nowrap text-gray-500">Min score</label
					>
					<input
						id="score-cutoff"
						type="range"
						min="0"
						max="0.95"
						step="0.01"
						bind:value={scoreCutoff}
						class="w-24 accent-primary"
					/>
					<span class="w-8 font-mono text-xs text-gray-600 tabular-nums">
						{scoreCutoff.toFixed(2)}
					</span>
					<HoverInfo
						text="A real cosine similarity, so the cut-off means something. Applied to the hits already fetched — moving it does not re-run anything — and to the neighbours of an anchored chunk as well as to search results. Past it, there is no more to load: a ranked list only goes down."
					/>
				</div>
			{/if}

			<KeywordInput
				bind:value={explore.keyword}
				bind:scope={explore.keywordScope}
				problem={explore.keywordProblem}
			/>
		</div>

		<div class="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
			<ControlRail
				bind:open={railOpen}
				{groupMode}
				{modes}
				{kind}
				bind:projection={explore.projection}
				bind:nNeighbors={explore.nNeighbors}
				bind:minDist={explore.minDist}
				bind:minClusterSize={explore.minClusterSize}
				{maxClusterSize}
				bind:centerByQuestion={explore.centerByQuestion}
				bind:centerByLanguage={explore.centerByLanguage}
				bind:interviewStatus={explore.interviewStatus}
				bind:filterLanguages={explore.filterLanguages}
				bind:includeSynthetic={explore.includeSynthetic}
				bind:filterQuestions={explore.filterQuestions}
				bind:keyword={explore.keyword}
				bind:keywordScope={explore.keywordScope}
				bind:surveyValues={explore.surveyValues}
				bind:surveyRanges={explore.surveyRanges}
				{guide}
				{surveyFacets}
				bind:visibleLanguages={explore.visibleLanguages}
				{listing}
				{languages}
				{multilingual}
				{offDefault}
				ongroupmode={changeGroupMode}
				onkind={changeKind}
			/>

			{#if listing}
				<ListView
					hits={listHits}
					total={listTotal}
					interviews={listInterviews}
					bind:order={explore.listOrder}
					loading={listLoading}
					error={listError}
					paging={listPaging}
					ranked={listRanked}
					keyword={explore.searchableKeyword}
					anchor={listAnchor}
					anchorLoading={walking && detail === null}
					onanchor={(hit) => (selectedId = selectedId === hit.id ? null : hit.id)}
					ontranscript={(hit) => (transcriptOf = hit)}
					{railOpen}
					{offDefault}
					onshowcontrols={() => (railOpen = true)}
					onclearanchor={() => (selectedId = null)}
				/>
			{:else}
				<!-- `min-w-0` is load-bearing: the scatter renders an <svg> with an
				     explicit pixel width, which becomes this item's intrinsic minimum
				     under the default `min-width: auto`. Without it the card keeps the
				     width it had while the rail was collapsed, and re-opening the rail
				     pushes the row wider than the page. -->
				<div
					class="flex min-h-[26rem] min-w-0 flex-1 flex-col rounded-lg border border-gray-200 bg-white"
				>
					<div class="relative min-h-0 flex-1">
						{#if !railOpen}
							<!-- The rail's way back. Over the map rather than beside it, so
							     a collapsed rail gives the map the whole width instead of
							     trading one strip of chrome for another. The list has no
							     empty corner to float over and carries its own, in the
							     strip above its results. -->
							<button
								type="button"
								onclick={() => (railOpen = true)}
								aria-label="Show controls"
								title={offDefault > 0 ? `Controls — ${offDefault} away from default` : 'Controls'}
								class="absolute top-2 left-2 z-30 flex cursor-pointer items-center gap-1 rounded-md border border-gray-200 bg-white/90 px-2 py-1 text-xs font-medium text-gray-600 shadow-sm hover:text-gray-900"
							>
								<i class="fa-solid fa-sliders text-[0.6875rem] text-gray-400"></i>
								{#if offDefault > 0}
									<span
										class="rounded-full bg-primary px-1.5 text-[0.625rem] font-semibold text-on-primary"
									>
										{offDefault}
									</span>
								{/if}
							</button>
						{/if}
						{#if unindexed}
							<!-- Before any cluster error, because "nothing is embedded" is
							     the cause of whatever the clustering endpoint said and the
							     reader can act on it. The list needs none of this, which is
							     why the page is not gated on it -- browsing and keyword
							     search read message rows, not vectors. -->
							<div
								class="flex h-full w-full flex-col items-center justify-center gap-3 p-8 text-center"
							>
								<i class="fa-solid fa-diagram-project text-lg text-gray-300"></i>
								<div>
									<p class="text-sm font-medium text-gray-700">Nothing is embedded yet</p>
									<p class="mx-auto mt-1 max-w-md text-sm text-gray-500">
										The map plots stored vectors, so there is nothing to draw until this project's
										transcripts are indexed.
										{canBackfill
											? 'Run “Re-embed project” above — it takes a few minutes and only has to be done once.'
											: 'An editor can start that from this page.'}
									</p>
									<p class="mx-auto mt-2 max-w-md text-xs text-gray-500">
										The list view works either way: browsing and keyword search read the transcripts
										themselves.
									</p>
								</div>
							</div>
						{:else if clusterError && !clusters}
							<p class="p-5 text-sm text-gray-500">{clusterError}</p>
						{:else if !clusters}
							<!-- The first run has nothing to keep on screen, so this is all
							     there is to look at. A grey box says only that something is
							     missing; naming the work and roughly how long it takes is the
							     difference between waiting and wondering whether it is broken. -->
							<SweepBar />
							<div
								class="flex h-full w-full flex-col items-center justify-center gap-3 p-8 text-center"
							>
								<i class="fa-solid fa-spinner fa-spin text-lg text-gray-300"></i>
								<div>
									<p class="text-sm font-medium text-gray-700">
										{explore.projection === 'umap' ? 'Projecting and clustering' : 'Clustering'}
									</p>
									<p class="mx-auto mt-1 max-w-sm text-xs text-gray-500">
										{#if explore.projection === 'umap'}
											UMAP is fitting {embeddedCount === null
												? 'the corpus'
												: `${formatNumber(embeddedCount)} chunks`} down to two dimensions and running
											HDBSCAN in them. A few seconds — longer on the first run after the server starts,
											which compiles the projection.
										{:else}
											Reducing {embeddedCount === null
												? 'the corpus'
												: `${formatNumber(embeddedCount)} chunks`} to 50 principal components and running
											HDBSCAN over them.
										{/if}
									</p>
								</div>
							</div>
						{:else if points.length === 0}
							<p class="p-5 text-sm text-gray-500">
								No chunks of this kind match the filters, so there is nothing to plot.
							</p>
						{:else}
							<ScatterPlot
								{points}
								{selectedId}
								bind:hoveredId
								{matchedIds}
								{colorOf}
								{grouped}
								{strengthOf}
								{visible}
								{describe}
								resetKey={`${kind}:${explore.projection}`}
								stale={clusterLoading}
								onselect={(id) => {
									selectedId = id;
									if (id) focusedGroup = null;
								}}
							/>
						{/if}
					</div>

					{#if clusters}
						<div
							class="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-gray-100 px-4 py-2 text-xs text-gray-500"
						>
							{#if groupMode === 'cluster'}
								<span>
									<span class="font-medium text-gray-700">{formatNumber(clusters.n_clusters)}</span>
									clusters
								</span>
							{:else}
								<span>
									<span class="font-medium text-gray-700">{formatNumber(groupCount)}</span>
									{modeLabel.toLowerCase()}
								</span>
								{#if ungrouped > 0}
									<span class="flex items-center gap-1.5">
										<span
											class="inline-block h-2 w-2 rounded-full"
											style="background:{OUTLIER_COLOR}"
										></span>
										{formatNumber(ungrouped)} without coordinates
									</span>
								{/if}
							{/if}
							<span>{formatNumber(clusters.n_points)} chunks</span>
							{#if groupMode === 'cluster'}
								<span class="flex items-center gap-1.5">
									<span class="inline-block h-2 w-2 rounded-full" style="background:{OUTLIER_COLOR}"
									></span>
									{formatNumber(clusters.n_outliers)} unplaced
								</span>
							{/if}
							<!-- What the two axes are worth, stated rather than left to be
							     assumed. PCA can put a number on it; UMAP cannot, and the
							     honest thing there is to say what the picture is instead of
							     borrowing a figure it did not produce. -->
							{#if clusters.explained_variance_2d !== null && clusters.explained_variance_2d !== undefined}
								<span class="flex items-center gap-1">
									{formatPercent(clusters.explained_variance_2d)} of the spread shown
									<!-- Around a third is normal for text embeddings: points far
									     apart really are far apart, but points close together need
									     not be. -->
									<HoverInfo
										text="The map is a flat shadow of a {clusters.components}-dimensional space, and shows about {formatPercent(
											clusters.explained_variance_2d
										)} of the variation in it. Read distance as a navigation aid, not as evidence — things far apart on screen are genuinely far apart, but things close together may not be."
									/>
								</span>
							{:else}
								<span class="flex items-center gap-1">
									Neighbourhood layout — distances are not to scale
									<HoverInfo
										text="UMAP is fitted to keep neighbours together, not to preserve distance, so there is no share-of-variance to report. Read which points sit with which; do not read how far apart two blobs are, or how big one is. A theme split across two blobs is a real possibility here — check each one's representatives before treating them as separate findings."
									/>
								</span>
							{/if}
							{#if !clusters.centered_by_question}
								<span class="text-amber-700">Uncentred by question</span>
							{/if}
							{#if multilingual && !clusters.centered_by_language}
								<span class="text-amber-700">Uncentred by language</span>
							{/if}
							<!-- Said here because every number in this strip is computed over
							     the whole run, hidden points included: the reader is looking
							     at a subset of a map that is still counted in full, and the
							     alternative — recounting on a view toggle — would make two
							     controls that look alike report different totals. -->
							{#if visibleLanguages.length > 0}
								<span class="flex items-center gap-1">
									Showing {visibleLanguages.map((code) => code.toUpperCase()).join(', ')}
									<HoverInfo
										text="A view filter: the map is unchanged and the other languages are faded, not removed. The counts here still describe every plotted chunk. To leave a language out of the projection and the clustering, use Languages under Corpus in the controls."
									/>
								</span>
							{/if}

							{#if clusterLoading}
								<!-- Named here rather than over the map: this strip is already
								     where the run describes itself, and a pill floating on the
								     scatter covered the corner the reader drags from. The bar
								     along the top edge is what catches the eye; this says which
								     of the numbers beside it are about to change. -->
								<span class="ml-auto flex items-center gap-1.5 text-gray-400">
									<i class="fa-solid fa-spinner fa-spin text-[0.625rem]"></i>
									Reclustering…
								</span>
							{/if}
						</div>
					{/if}
				</div>

				<div class="flex min-h-[26rem] shrink-0 lg:w-[24rem]">
					<div class="w-full">
						<DetailPanel
							clusters={clusters?.clusters ?? null}
							{groups}
							{groupMode}
							{multilingual}
							clustersLoading={clusterLoading && clusters === null}
							search={visibleSearch}
							{searchLoading}
							{searchError}
							{searchPaging}
							detail={visibleDetail}
							{detailLoading}
							{detailError}
							{neighbourPaging}
							{selectedId}
							{focusedGroup}
							onselect={(id) => (selectedId = id)}
							onfocusgroup={(key) => (focusedGroup = key)}
							ontranscript={(hit) => (transcriptOf = hit)}
						/>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>

<!-- Outside the layout entirely: it portals to the body, and the reader opening
     it has not navigated anywhere — the list, the filters and the scroll
     position are all still behind it, which is the whole reason it is a dialog
     and not the transcript page. -->
<TranscriptModal
	hit={transcriptOf}
	keyword={explore.searchableKeyword}
	keywordScope={explore.keywordScope}
	onclose={() => (transcriptOf = null)}
/>
