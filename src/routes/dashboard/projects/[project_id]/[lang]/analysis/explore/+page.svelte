<script lang="ts">
	import { page } from '$app/state';
	import { Analysis } from '$lib/api';
	import type {
		EmbeddingClusterPoint,
		EmbeddingClusterResponse,
		EmbeddingKind,
		EmbeddingSearchResponse,
		EmbeddingSimilarResponse,
		EmbeddingStatus,
		GroupKind,
		InterviewStatus,
		Projection
	} from '$lib/api/types.gen';
	import HoverInfo from '$lib/components/HoverInfo.svelte';
	import { OUTLIER_COLOR, mapColor } from '$lib/config/chartColors';
	import { Switch } from 'bits-ui';
	import { format } from 'd3-format';
	import type { PageData } from './$types';
	import DetailPanel from './DetailPanel.svelte';
	import ScatterPlot from './ScatterPlot.svelte';
	import StatusStrip from './StatusStrip.svelte';
	import {
		DEFAULT_CENTER_BY_LANGUAGE,
		DEFAULT_CENTER_BY_QUESTION,
		DEFAULT_GROUP_MODE,
		DEFAULT_K,
		DEFAULT_KIND,
		DEFAULT_MIN_CLUSTER_SIZE,
		DEFAULT_MIN_DIST,
		DEFAULT_N_NEIGHBORS,
		DEFAULT_PROJECTION,
		DEFAULT_TASK,
		GROUP_MODES,
		KINDS,
		MIN_CLUSTER_SIZE_RANGE,
		MIN_DIST_RANGE,
		N_NEIGHBORS_RANGE,
		PROJECTIONS,
		clusterQuery,
		defaultFilters,
		describeError,
		filterQuery,
		groupKeyOf,
		groupOrder,
		isDefaultClusterSettings,
		type ClusterSettings
	} from './explore';

	let { data }: { data: PageData } = $props();

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

	// The knobs. `kind` and the filters are shared by every request on the page;
	// the rest belong to the clustering alone.
	let kind = $state<EmbeddingKind>(DEFAULT_KIND);
	let projection = $state<Projection>(DEFAULT_PROJECTION);
	let nNeighbors = $state(DEFAULT_N_NEIGHBORS);
	let minDist = $state(DEFAULT_MIN_DIST);
	let minClusterSize = $state(DEFAULT_MIN_CLUSTER_SIZE);
	let centerByQuestion = $state(DEFAULT_CENTER_BY_QUESTION);
	let centerByLanguage = $state(DEFAULT_CENTER_BY_LANGUAGE);
	let interviewStatus = $state<InterviewStatus | null>(defaultFilters().status);
	let includeSynthetic = $state(defaultFilters().include_synthetic);

	let filters = $derived({ status: interviewStatus, include_synthetic: includeSynthetic });
	let settings = $derived<ClusterSettings>({
		kind,
		projection,
		n_neighbors: nNeighbors,
		min_dist: minDist,
		min_cluster_size: minClusterSize,
		center_by_question: centerByQuestion,
		center_by_language: centerByLanguage,
		filters
	});

	let clusters = $state<EmbeddingClusterResponse | null>(null);
	let clusterLoading = $state(true);
	let clusterError = $state<string | null>(null);

	// The box holds what is being typed; `submitted` holds what was searched
	// for. Kept apart because a semantic search costs an inference call — this
	// is not a filter box that narrows a list on every keystroke, and pretending
	// it is would put a request behind every letter.
	let queryText = $state('');
	let submitted = $state('');
	let searchResponse = $state<EmbeddingSearchResponse | null>(null);
	let searchLoading = $state(false);
	let searchError = $state<string | null>(null);
	let scoreCutoff = $state(0);

	let selectedId = $state<string | null>(null);
	let detail = $state<EmbeddingSimilarResponse | null>(null);
	let detailLoading = $state(false);
	let detailError = $state<string | null>(null);

	let focusedGroup = $state<string | null>(null);
	let hoveredId = $state<string | null>(null);

	/**
	 * What the map is coloured by. Not part of `ClusterSettings`: all three
	 * groupings are read off one response — the clustering the server ran, and
	 * the guide coordinates it now returns per point — so switching costs a
	 * recolour rather than a request.
	 */
	let groupMode = $state<GroupKind>(DEFAULT_GROUP_MODE);

	/** Text search is the one thing here that needs the inference server. */
	let searchAvailable = $derived(status?.healthy ?? false);

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

	// -- clusters -------------------------------------------------------------

	/**
	 * How long to sit on a settings change before asking.
	 *
	 * A drag across a slider track emits a value per pixel, and every one of
	 * those is a request the reader has already moved past. PCA recomputes in
	 * around 200 ms, which is what makes these sliders rather than form fields;
	 * UMAP is seconds, so it waits longer before committing to one.
	 */
	const CLUSTER_DEBOUNCE_MS = { pca: 250, umap: 500 } as const;

	let clusterProjectId: string | null = null;
	let seenClusterPreload: PageData['clusters'] | null = null;

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

		const adopting = preloaded !== seenClusterPreload && isDefaultClusterSettings(settings);
		seenClusterPreload = preloaded;

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
			adopting ? 0 : CLUSTER_DEBOUNCE_MS[query.projection]
		);

		return () => {
			disposed = true;
			clearTimeout(timer);
			controller.abort();
		};
	});

	// -- search ---------------------------------------------------------------

	$effect(() => {
		const projectId = data.project_id;
		const query = submitted.trim();
		const currentKind = kind;
		const currentFilters = filterQuery(filters);

		if (!query) {
			searchResponse = null;
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
				query: { query, kind: currentKind, task: DEFAULT_TASK, k: DEFAULT_K, ...currentFilters },
				signal: controller.signal
			});
			if (disposed) return;

			searchLoading = false;
			if (error || !body) {
				searchResponse = null;
				searchError = describeError(response?.status, 'The search could not be run.');
				return;
			}

			searchResponse = body;
			searchError = null;
		})();

		return () => {
			disposed = true;
			controller.abort();
		};
	});

	/**
	 * The cut-off is applied here rather than sent to the server. The score is a
	 * real cosine value, so the reader can judge it — but only once they have
	 * seen the numbers the query actually produced, and re-running the search to
	 * drop three rows would cost another inference call for nothing.
	 */
	let visibleSearch = $derived.by((): EmbeddingSearchResponse | null => {
		if (!searchResponse) return null;
		if (scoreCutoff <= 0) return searchResponse;
		return {
			...searchResponse,
			items: (searchResponse.items ?? []).filter((hit) => hit.score >= scoreCutoff)
		};
	});

	// -- chunk detail ---------------------------------------------------------

	$effect(() => {
		const projectId = data.project_id;
		const id = selectedId;
		const currentFilters = filterQuery(filters);

		if (!id) {
			detail = null;
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
				query: { k: DEFAULT_K, ...currentFilters },
				signal: controller.signal
			});
			if (disposed) return;

			detailLoading = false;
			if (error || !body) {
				detail = null;
				detailError = describeError(response?.status, 'Could not load this chunk.');
				return;
			}

			detail = body;
			detailError = null;
		})();

		return () => {
			disposed = true;
			controller.abort();
		};
	});

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
	 * Whether there is more than one language on the map.
	 *
	 * On a single-language project, colouring by language paints every point
	 * the same colour and the purity of every cluster is 1.0 — a control that
	 * can only ever say one thing, and a warning that can only ever be noise.
	 * So the mode and the badge are offered only where they can distinguish.
	 */
	let multilingual = $derived(new Set(points.map((point) => point.language)).size > 1);

	let modes = $derived(GROUP_MODES.filter((mode) => mode.value !== 'language' || multilingual));

	// A filter can take the last of a second language off the map while it is
	// what the points are coloured by, which would leave the reader on a mode
	// whose button has just gone.
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
		void minClusterSize;
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
		if (minClusterSize > maxClusterSize) minClusterSize = maxClusterSize;
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
		scoreCutoff = 0;
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
		<p class="mt-1 max-w-2xl text-sm text-gray-500">
			Search the transcripts by meaning rather than by wording, and see how the answers group.
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
	{:else if status && (status.total ?? 0) === 0}
		<StatusStrip
			{status}
			projectId={data.project_id}
			{canBackfill}
			onstatus={(next) => (status = next)}
		/>
		<div class="rounded-lg border border-gray-200 bg-white px-5 py-8 text-center">
			<p class="text-sm font-medium text-gray-700">Nothing is embedded yet</p>
			<p class="mx-auto mt-1 max-w-md text-sm text-gray-500">
				{canBackfill
					? 'Run “Re-embed project” above to index this project’s transcripts. It takes a few minutes and only has to be done once.'
					: 'This project’s transcripts have not been indexed. An editor can start that from this page.'}
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

		<!-- Controls. Search on top because it is what most readers come for;
		     the clustering knobs beneath it because they change what the map
		     means and deserve to be read, not hunted for. -->
		<div class="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3">
			<form onsubmit={search} class="flex items-center gap-2">
				<div class="relative flex-1">
					<i
						class="fas fa-magnifying-glass pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-xs text-gray-300"
					></i>
					<input
						type="search"
						bind:value={queryText}
						disabled={!searchAvailable}
						placeholder="How do people describe trust?"
						aria-label="Search the transcripts by meaning"
						class="w-full rounded-md border border-gray-200 py-1.5 pr-3 pl-8 text-sm placeholder:text-gray-300 focus:border-primary focus:ring-0 disabled:bg-gray-50"
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

			<div class="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-gray-600">
				<div class="flex items-center gap-1.5">
					<span class="text-gray-500">Projection</span>
					<!-- The one control that changes what the picture *is* rather than
					     how it is coloured, so it leads. Both cluster in the space they
					     plot; they disagree about what that space should be, and the
					     only way to tell which is right about this corpus is to look at
					     both. -->
					<div class="flex overflow-hidden rounded-md border border-gray-200">
						{#each PROJECTIONS as option (option.value)}
							<button
								type="button"
								onclick={() => (projection = option.value)}
								aria-pressed={projection === option.value}
								class="cursor-pointer px-2 py-1 font-medium transition-colors {projection ===
								option.value
									? 'bg-primary text-on-primary'
									: 'bg-white text-gray-500 hover:text-gray-900'}"
							>
								{option.label}
							</button>
						{/each}
					</div>
					<HoverInfo text={PROJECTIONS.find((option) => option.value === projection)?.hint ?? ''} />
				</div>

				{#if projection === 'umap'}
					<!-- UMAP's shape knobs, shown only where they do anything. PCA takes
					     neither, and the page does not send them under it. -->
					<label class="flex items-center gap-2">
						<span class="text-gray-500">Neighbours</span>
						<input
							type="range"
							min={N_NEIGHBORS_RANGE.min}
							max={N_NEIGHBORS_RANGE.max}
							bind:value={nNeighbors}
							class="w-28 accent-primary"
						/>
						<span class="w-6 font-mono tabular-nums">{nNeighbors}</span>
						<HoverInfo
							text="How much of the corpus each point is fitted against. Low keeps local detail and fragments the map; high recovers global structure and smooths the detail away. 15 is a reasonable middle."
						/>
					</label>

					<label class="flex items-center gap-2">
						<span class="text-gray-500">Min distance</span>
						<input
							type="range"
							min={MIN_DIST_RANGE.min}
							max={MIN_DIST_RANGE.max}
							step={MIN_DIST_RANGE.step}
							bind:value={minDist}
							class="w-24 accent-primary"
						/>
						<span class="w-8 font-mono tabular-nums">{minDist.toFixed(2)}</span>
						<HoverInfo
							text="How tightly points may pack. 0 gives the clumped layout HDBSCAN reads best; raising it spreads each blob out, which is easier to look at and harder to cluster."
						/>
					</label>
				{/if}

				<div class="flex items-center gap-1.5">
					<span class="text-gray-500">Group by</span>
					<!-- A segmented control rather than a select: the alternatives are
					     the reason to look at the clusters at all, and the comparison
					     only works if switching between them is a single click. -->
					<div class="flex overflow-hidden rounded-md border border-gray-200">
						{#each modes as mode (mode.value)}
							<button
								type="button"
								onclick={() => changeGroupMode(mode.value)}
								aria-pressed={groupMode === mode.value}
								class="cursor-pointer px-2 py-1 font-medium transition-colors {groupMode ===
								mode.value
									? 'bg-primary text-on-primary'
									: 'bg-white text-gray-500 hover:text-gray-900'}"
							>
								{mode.label}
							</button>
						{/each}
					</div>
					<HoverInfo text={modes.find((mode) => mode.value === groupMode)?.hint ?? ''} />
				</div>

				<label class="flex items-center gap-1.5">
					<span class="text-gray-500">Unit</span>
					<select
						value={kind}
						onchange={(event) => changeKind(event.currentTarget.value as EmbeddingKind)}
						class="rounded-md border border-gray-200 py-1 pr-7 pl-2 text-xs focus:border-primary focus:ring-0"
					>
						{#each KINDS as option (option.value)}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
					<HoverInfo text={KINDS.find((option) => option.value === kind)?.hint ?? ''} />
				</label>

				<!-- Greyed out away from the clusters, where it changes nothing that
				     is on screen: the positions come from the projection, and the
				     cluster ids it does change are not what the points are coloured
				     by. Centring below stays live in every mode — it moves the points
				     themselves, and watching a question's colour scatter as it comes
				     on is the whole reason to colour by question. -->
				<label class="flex items-center gap-2" class:opacity-40={groupMode !== 'cluster'}>
					<span class="text-gray-500">Min cluster size</span>
					<input
						type="range"
						min={MIN_CLUSTER_SIZE_RANGE.min}
						max={maxClusterSize}
						bind:value={minClusterSize}
						disabled={groupMode !== 'cluster'}
						class="w-32 accent-primary disabled:cursor-not-allowed"
					/>
					<span class="w-6 font-mono tabular-nums">{minClusterSize}</span>
					<HoverInfo
						text={groupMode !== 'cluster'
							? 'Only affects the clusters, which is not what the map is coloured by right now. Switch back to Clusters to use it.'
							: projection === 'pca'
								? 'The smallest group HDBSCAN will call a cluster. Lower it to break the map into finer themes; raise it for a few broad ones. Recomputes in about a fifth of a second, so drag it.'
								: 'The smallest group HDBSCAN will call a cluster. Lower it to break the map into finer themes; raise it for a few broad ones. Under UMAP each change is a few seconds, so nudge it rather than dragging.'}
					/>
				</label>

				<div class="flex items-center gap-2">
					<Switch.Root
						id="center-by-question"
						bind:checked={centerByQuestion}
						class="inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-gray-200 bg-gray-200 transition-colors data-[state=checked]:border-primary data-[state=checked]:bg-primary"
					>
						<Switch.Thumb
							class="pointer-events-none block h-4 w-4 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[1.125rem]"
						/>
					</Switch.Root>
					<label for="center-by-question" class="cursor-pointer">Centre by question</label>
					<HoverInfo
						text="Every respondent was asked the same questions, and a chunk contains its question verbatim — so left alone, clustering recovers the interview guide rather than what anyone said. Centring subtracts each question's average before grouping, leaving the variation between answers. Turn it off to see the raw structure."
					/>
				</div>

				{#if multilingual}
					<!-- Offered only on a corpus with more than one language in it, where
					     it is the difference between a map of what people said and a map
					     of which language they said it in. -->
					<div class="flex items-center gap-2">
						<Switch.Root
							id="center-by-language"
							bind:checked={centerByLanguage}
							class="inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-gray-200 bg-gray-200 transition-colors data-[state=checked]:border-primary data-[state=checked]:bg-primary"
						>
							<Switch.Thumb
								class="pointer-events-none block h-4 w-4 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[1.125rem]"
							/>
						</Switch.Root>
						<label for="center-by-language" class="cursor-pointer">Centre by language</label>
						<HoverInfo
							text="Language is one of the loudest signals in an embedding: left alone, the Danish answers sit with the Danish answers whatever anybody said. Centring subtracts each language's average before grouping, so the map is about what was said rather than what it was said in. Turn it off to see how much of the structure was language."
						/>
					</div>
				{/if}

				<div class="flex items-center gap-2">
					<Switch.Root
						id="include-synthetic"
						bind:checked={includeSynthetic}
						class="inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-gray-200 bg-gray-200 transition-colors data-[state=checked]:border-primary data-[state=checked]:bg-primary"
					>
						<Switch.Thumb
							class="pointer-events-none block h-4 w-4 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[1.125rem]"
						/>
					</Switch.Root>
					<label for="include-synthetic" class="cursor-pointer">Include test runs</label>
				</div>

				<label class="flex items-center gap-1.5">
					<span class="text-gray-500">Interviews</span>
					<select
						bind:value={interviewStatus}
						class="rounded-md border border-gray-200 py-1 pr-7 pl-2 text-xs focus:border-primary focus:ring-0"
					>
						<option value={null}>Any status</option>
						<option value="completed">Completed</option>
						<option value="active">Active</option>
						<option value="inactive">Inactive</option>
					</select>
				</label>

				{#if searchResponse}
					<label class="flex items-center gap-2">
						<span class="text-gray-500">Min score</span>
						<input
							type="range"
							min="0"
							max="0.95"
							step="0.01"
							bind:value={scoreCutoff}
							class="w-24 accent-primary"
						/>
						<span class="w-8 font-mono tabular-nums">{scoreCutoff.toFixed(2)}</span>
						<HoverInfo
							text="A real cosine similarity, so the cut-off is meaningful. Applied to the results already fetched — moving it does not re-run the search."
						/>
					</label>
				{/if}
			</div>
		</div>

		<div class="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
			<div class="flex min-h-[26rem] flex-1 flex-col rounded-lg border border-gray-200 bg-white">
				<div class="relative min-h-0 flex-1">
					{#if clusterError && !clusters}
						<p class="p-5 text-sm text-gray-500">{clusterError}</p>
					{:else if !clusters}
						<div class="h-full w-full animate-pulse rounded-lg bg-gray-100"></div>
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
							{describe}
							resetKey={`${kind}:${projection}`}
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
									<span class="inline-block h-2 w-2 rounded-full" style="background:{OUTLIER_COLOR}"
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
					</div>
				{/if}
			</div>

			<div class="flex min-h-[26rem] shrink-0 lg:w-[24rem]">
				<div class="w-full">
					<DetailPanel
						clusters={clusters?.clusters ?? []}
						{groups}
						{groupMode}
						{multilingual}
						search={visibleSearch}
						{searchLoading}
						{searchError}
						cutoffHiding={(searchResponse?.items ?? []).length -
							(visibleSearch?.items ?? []).length}
						{detail}
						{detailLoading}
						{detailError}
						{selectedId}
						{focusedGroup}
						onselect={(id) => (selectedId = id)}
						onfocusgroup={(key) => (focusedGroup = key)}
					/>
				</div>
			</div>
		</div>
	{/if}
</div>
