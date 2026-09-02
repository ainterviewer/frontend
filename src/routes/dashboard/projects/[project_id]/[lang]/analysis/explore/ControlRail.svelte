<script lang="ts">
	import type {
		EmbeddingKind,
		GroupKind,
		InterviewStatus,
		LanguageCode,
		Projection
	} from '$lib/api/types.gen';
	import HoverInfo from '$lib/components/HoverInfo.svelte';
	import { Switch } from 'bits-ui';
	import { format } from 'd3-format';
	import type { Snippet } from 'svelte';
	import {
		DEFAULT_CENTER_BY_LANGUAGE,
		DEFAULT_CENTER_BY_QUESTION,
		DEFAULT_MIN_CLUSTER_SIZE,
		DEFAULT_MIN_DIST,
		DEFAULT_N_NEIGHBORS,
		DEFAULT_PROJECTION,
		KINDS,
		MIN_CLUSTER_SIZE_RANGE,
		MIN_DIST_RANGE,
		N_NEIGHBORS_RANGE,
		PROJECTIONS,
		defaultFilters,
		toggleLanguage
	} from './explore';

	let {
		open = $bindable(),
		groupMode,
		modes,
		kind,
		projection = $bindable(),
		nNeighbors = $bindable(),
		minDist = $bindable(),
		minClusterSize = $bindable(),
		maxClusterSize,
		centerByQuestion = $bindable(),
		centerByLanguage = $bindable(),
		interviewStatus = $bindable(),
		filterLanguages = $bindable(),
		includeSynthetic = $bindable(),
		visibleLanguages = $bindable(),
		scoreCutoff = $bindable(),
		searching,
		languages,
		multilingual,
		offDefault,
		ongroupmode,
		onkind
	}: {
		open: boolean;
		groupMode: GroupKind;
		/** The grouping modes on offer, which is not every mode the API has. */
		modes: { value: GroupKind; label: string; hint: string }[];
		kind: EmbeddingKind;
		projection: Projection;
		nNeighbors: number;
		minDist: number;
		minClusterSize: number;
		/** Read off the run on screen, so the top of the slider means something. */
		maxClusterSize: number;
		centerByQuestion: boolean;
		centerByLanguage: boolean;
		interviewStatus: InterviewStatus | null;
		/**
		 * Languages the corpus is narrowed to before it is projected, empty for
		 * all of them. Costs a refetch, and moves every point on the map: the
		 * projection is fitted to what is left.
		 */
		filterLanguages: LanguageCode[];
		includeSynthetic: boolean;
		/**
		 * Languages currently on show, empty for all of them. Costs nothing and
		 * moves nothing — the same projection with the rest faded out — which is
		 * why it sits under Colour rather than beside the filters.
		 */
		visibleLanguages: LanguageCode[];
		scoreCutoff: number;
		/** Whether a search is up, which is the only time a score cut-off means anything. */
		searching: boolean;
		/**
		 * The languages on offer: the project's own localizations at first paint,
		 * replaced by what the corpus actually holds once the status call lands.
		 * Never the plotted points, which the filter below would narrow out from
		 * under itself. `count` is null while it is the former — the project
		 * knows its languages, not how much of each is embedded.
		 */
		languages: { code: LanguageCode; name: string; count: number | null }[];
		/**
		 * Whether the corpus holds more than one language. Centring on language,
		 * filtering by it and hiding one are all real choices only where there is
		 * more than one; on a single-language corpus centring subtracts one mean
		 * from everything and the other two can only ever say "all of it".
		 */
		multilingual: boolean;
		/** How many settings are off default, counted by `offDefaultCount`. */
		offDefault: number;
		/** Both of these invalidate a selection, so the page owns them. */
		ongroupmode: (next: GroupKind) => void;
		onkind: (next: EmbeddingKind) => void;
	} = $props();

	function reset() {
		projection = DEFAULT_PROJECTION;
		nNeighbors = DEFAULT_N_NEIGHBORS;
		minDist = DEFAULT_MIN_DIST;
		minClusterSize = DEFAULT_MIN_CLUSTER_SIZE;
		centerByQuestion = DEFAULT_CENTER_BY_QUESTION;
		centerByLanguage = DEFAULT_CENTER_BY_LANGUAGE;
		interviewStatus = defaultFilters().status;
		filterLanguages = defaultFilters().languages;
		includeSynthetic = defaultFilters().include_synthetic;
		// Not counted by `offDefault` — it is a view, not a setting — but a reader
		// reaching for the way back means the whole map, not most of it.
		visibleLanguages = [];
	}

	let clustering = $derived(groupMode === 'cluster');

	const formatNumber = format(',');

	/** The order a selection is kept in, so two chips read the same either way. */
	let codes = $derived(languages.map((language) => language.code));
</script>

{#snippet heading(text: string)}
	<h3
		class="mt-5 mb-1.5 text-[0.6875rem] font-semibold tracking-wide text-gray-400 uppercase first:mt-0"
	>
		{text}
	</h3>
{/snippet}

<!-- A control wide enough to need the whole rail: its name and current value on
     one line, the control itself on the next. Sliders and selects do not fit
     beside a label at this width, and shrinking them to fit would make the one
     thing the reader drags the smallest thing on screen. -->
{#snippet stacked(label: string, hint: string, value: string | null, control: Snippet)}
	<div class="py-1.5">
		<div class="flex items-baseline justify-between gap-2">
			<span class="flex items-center gap-1.5 text-xs text-gray-600">
				{label}
				<HoverInfo text={hint} />
			</span>
			{#if value !== null}
				<span class="font-mono text-xs text-gray-500 tabular-nums">{value}</span>
			{/if}
		</div>
		<div class="mt-1.5">{@render control()}</div>
	</div>
{/snippet}

<!-- A switch and its name, which do fit on one line together. -->
{#snippet inline(label: string, hint: string, control: Snippet)}
	<div class="flex items-center justify-between gap-2 py-1.5">
		<span class="flex items-center gap-1.5 text-xs text-gray-600">
			{label}
			<HoverInfo text={hint} />
		</span>
		{@render control()}
	</div>
{/snippet}

{#snippet toggle(label: string, checked: boolean, set: (value: boolean) => void)}
	<Switch.Root
		{checked}
		onCheckedChange={set}
		aria-label={label}
		class="inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-gray-200 bg-gray-200 transition-colors data-[state=checked]:border-primary data-[state=checked]:bg-primary"
	>
		<Switch.Thumb
			class="pointer-events-none block h-4 w-4 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[1.125rem]"
		/>
	</Switch.Root>
{/snippet}

{#snippet groupControl()}
	<!-- One row per mode rather than a segmented strip: four labels do not fit
	     across the rail, and stacking them gives each its own hover text. -->
	<div role="radiogroup" aria-label="Group by" class="flex flex-col gap-0.5">
		{#each modes as mode (mode.value)}
			<button
				type="button"
				role="radio"
				aria-checked={groupMode === mode.value}
				onclick={() => ongroupmode(mode.value)}
				class="flex cursor-pointer items-center justify-between gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors {groupMode ===
				mode.value
					? 'bg-primary text-on-primary'
					: 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}"
			>
				{mode.label}
				<HoverInfo text={mode.hint} />
			</button>
		{/each}
	</div>
{/snippet}

{#snippet kindControl()}
	<select
		value={kind}
		onchange={(event) => onkind(event.currentTarget.value as EmbeddingKind)}
		aria-label="Unit"
		class="w-full rounded-md border border-gray-200 py-1 pr-7 pl-2 text-xs focus:border-primary focus:ring-0"
	>
		{#each KINDS as option (option.value)}
			<option value={option.value}>{option.label}</option>
		{/each}
	</select>
{/snippet}

{#snippet statusControl()}
	<select
		bind:value={interviewStatus}
		aria-label="Interview status"
		class="w-full rounded-md border border-gray-200 py-1 pr-7 pl-2 text-xs focus:border-primary focus:ring-0"
	>
		<option value={null}>Any status</option>
		<option value="completed">Completed</option>
		<option value="active">Active</option>
		<option value="inactive">Inactive</option>
	</select>
{/snippet}

{#snippet syntheticControl()}
	{@render toggle('Include test runs', includeSynthetic, (value) => (includeSynthetic = value))}
{/snippet}

{#snippet projectionControl()}
	<div
		role="group"
		aria-label="Projection"
		class="flex overflow-hidden rounded-md border border-gray-200"
	>
		{#each PROJECTIONS as option (option.value)}
			<button
				type="button"
				onclick={() => (projection = option.value)}
				aria-pressed={projection === option.value}
				class="flex-1 cursor-pointer px-2 py-1 text-xs font-medium transition-colors {projection ===
				option.value
					? 'bg-primary text-on-primary'
					: 'bg-white text-gray-500 hover:text-gray-900'}"
			>
				{option.label}
			</button>
		{/each}
	</div>
{/snippet}

{#snippet neighborsControl()}
	<input
		type="range"
		min={N_NEIGHBORS_RANGE.min}
		max={N_NEIGHBORS_RANGE.max}
		bind:value={nNeighbors}
		aria-label="Neighbours"
		class="w-full accent-primary"
	/>
{/snippet}

{#snippet minDistControl()}
	<input
		type="range"
		min={MIN_DIST_RANGE.min}
		max={MIN_DIST_RANGE.max}
		step={MIN_DIST_RANGE.step}
		bind:value={minDist}
		aria-label="Min distance"
		class="w-full accent-primary"
	/>
{/snippet}

{#snippet clusterSizeControl()}
	<input
		type="range"
		min={MIN_CLUSTER_SIZE_RANGE.min}
		max={maxClusterSize}
		bind:value={minClusterSize}
		disabled={!clustering}
		aria-label="Min cluster size"
		class="w-full accent-primary disabled:cursor-not-allowed"
	/>
{/snippet}

{#snippet questionControl()}
	{@render toggle('Centre by question', centerByQuestion, (value) => (centerByQuestion = value))}
{/snippet}

{#snippet languageControl()}
	{@render toggle('Centre by language', centerByLanguage, (value) => (centerByLanguage = value))}
{/snippet}

<!-- A wrapped row of chips rather than a multi-select: three or four language
     codes fit across the rail, every option is one click from every other, and
     an empty selection has somewhere to be said out loud. "All" is a state, not
     a shortcut — it is what an empty list means, and clicking it clears. -->
{#snippet languageChips(
	name: string,
	selected: LanguageCode[],
	set: (next: LanguageCode[]) => void
)}
	<div role="group" aria-label={name} class="flex flex-wrap gap-1">
		<button
			type="button"
			aria-pressed={selected.length === 0}
			onclick={() => set([])}
			class="cursor-pointer rounded-md border px-1.5 py-0.5 text-[0.6875rem] font-medium transition-colors {selected.length ===
			0
				? 'border-primary bg-primary text-on-primary'
				: 'border-gray-200 text-gray-500 hover:text-gray-900'}"
		>
			All
		</button>
		{#each languages as language (language.code)}
			{@const on = selected.includes(language.code)}
			<!-- The code on the chip and the name in the tooltip, rather than the
			     other way round: four names do not fit across the rail, and the
			     codes are what the map's own legend and hover cards say. -->
			<button
				type="button"
				aria-pressed={on}
				aria-label={language.name}
				title={language.count === null
					? language.name
					: `${language.name} — ${formatNumber(language.count)} chunks`}
				onclick={() => set(toggleLanguage(selected, language.code, codes))}
				class="flex cursor-pointer items-baseline gap-1 rounded-md border px-1.5 py-0.5 text-[0.6875rem] font-medium transition-colors {on
					? 'border-primary bg-primary text-on-primary'
					: 'border-gray-200 text-gray-500 hover:text-gray-900'}"
			>
				{language.code.toUpperCase()}
				{#if language.count !== null}
					<span
						class="font-mono text-[0.625rem] tabular-nums {on ? 'opacity-70' : 'text-gray-400'}"
					>
						{formatNumber(language.count)}
					</span>
				{/if}
			</button>
		{/each}
	</div>
{/snippet}

{#snippet visibleLanguageControl()}
	{@render languageChips('Languages shown', visibleLanguages, (next) => (visibleLanguages = next))}
{/snippet}

{#snippet filterLanguageControl()}
	{@render languageChips('Languages included', filterLanguages, (next) => (filterLanguages = next))}
{/snippet}

{#snippet cutoffControl()}
	<input
		type="range"
		min="0"
		max="0.95"
		step="0.01"
		bind:value={scoreCutoff}
		aria-label="Min score"
		class="w-full accent-primary"
	/>
{/snippet}

{#if open}
	<div
		class="flex shrink-0 flex-col rounded-lg border border-gray-200 bg-white lg:min-h-[26rem] lg:w-[15rem]"
	>
		<div class="flex items-center justify-between border-b border-gray-100 px-3 py-2">
			<h2 class="text-[0.6875rem] font-semibold tracking-wide text-gray-400 uppercase">Controls</h2>
			<button
				type="button"
				onclick={() => (open = false)}
				aria-label="Hide controls"
				class="cursor-pointer rounded p-1 text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-700"
			>
				<i class="fas fa-angles-left text-[0.6875rem]"></i>
			</button>
		</div>

		<div class="min-h-0 flex-1 overflow-y-auto px-3 py-3">
			{@render heading('Colour')}
			{@render stacked('Group by', 'What the map is coloured by.', null, groupControl)}
			{#if multilingual}
				{@render stacked(
					'Show',
					'Which languages to look at. The map is not recomputed — the same points stay where they are and the rest fade back, so a language can be picked out of the layout the whole corpus produced. Cluster sizes, counts and purity still describe every point. To leave a language out of the projection itself, use the filter under Corpus.',
					visibleLanguages.length === 0
						? 'All'
						: `${visibleLanguages.length} of ${languages.length}`,
					visibleLanguageControl
				)}
			{/if}

			{@render heading('Corpus')}
			{@render stacked(
				'Unit',
				KINDS.find((option) => option.value === kind)?.hint ?? '',
				null,
				kindControl
			)}
			{@render stacked(
				'Interviews',
				'Which interviews the chunks are drawn from. Applied in SQL before anything is scored, so it narrows the pool rather than the result list — asking for ten hits from completed interviews returns ten of those.',
				null,
				statusControl
			)}
			{#if multilingual}
				{@render stacked(
					'Languages',
					'Which languages the chunks are drawn from. Applied in SQL before anything is embedded into the projection, so the axes, the clusters and every purity figure are computed over the languages left — a real narrowing of the corpus, and a recompute. To keep the whole map and just look at one language, use Show under Colour.',
					filterLanguages.length === 0 ? 'All' : `${filterLanguages.length} of ${languages.length}`,
					filterLanguageControl
				)}
			{/if}
			{@render inline(
				'Include test runs',
				'Synthetic interviews, run to try the guide out rather than answered by a respondent. Off by default: they are rarely findings.',
				syntheticControl
			)}

			{@render heading('Layout')}
			{@render stacked(
				'Projection',
				PROJECTIONS.find((option) => option.value === projection)?.hint ?? '',
				null,
				projectionControl
			)}
			{#if projection === 'umap'}
				<!-- UMAP's shape knobs, shown only where they do anything. PCA takes
				     neither, and the page does not send them under it. -->
				{@render stacked(
					'Neighbours',
					'How much of the corpus each point is fitted against. Low keeps local detail and fragments the map; high recovers global structure and smooths the detail away. 15 is a reasonable middle.',
					String(nNeighbors),
					neighborsControl
				)}
				{@render stacked(
					'Min distance',
					'How tightly points may pack. 0 gives the clumped layout HDBSCAN reads best; raising it spreads each blob out, which is easier to look at and harder to cluster.',
					minDist.toFixed(2),
					minDistControl
				)}
			{/if}

			{@render heading('Clustering')}
			<!-- Dimmed away from the clusters, where it changes nothing that is on
			     screen: the positions come from the projection, and the cluster ids
			     it does change are not what the points are coloured by. The centring
			     toggles below stay live in every mode — they move the points
			     themselves, and watching a question's colour scatter as centring
			     comes on is the whole reason to colour by question. -->
			<div class:opacity-40={!clustering}>
				{@render stacked(
					'Min cluster size',
					clustering
						? projection === 'pca'
							? 'The smallest group HDBSCAN will call a cluster. Lower it to break the map into finer themes; raise it for a few broad ones. Recomputes in about a fifth of a second, so drag it.'
							: 'The smallest group HDBSCAN will call a cluster. Lower it to break the map into finer themes; raise it for a few broad ones. Under UMAP each change is a few seconds, so nudge it rather than dragging.'
						: 'Only affects the clusters, which is not what the map is coloured by right now. Switch back to Clusters to use it.',
					String(minClusterSize),
					clusterSizeControl
				)}
			</div>
			{@render inline(
				'Centre by question',
				"Every respondent was asked the same questions, and a chunk contains its question verbatim — so left alone, clustering recovers the interview guide rather than what anyone said. Centring subtracts each question's average before grouping, leaving the variation between answers. Turn it off to see the raw structure.",
				questionControl
			)}
			{#if multilingual}
				{@render inline(
					'Centre by language',
					"Language is one of the loudest signals in an embedding: left alone, the Danish answers sit with the Danish answers whatever anybody said. Centring subtracts each language's average before grouping, so the map is about what was said rather than what it was said in. Turn it off to see how much of the structure was language.",
					languageControl
				)}
			{/if}

			{#if searching}
				{@render heading('Search results')}
				{@render stacked(
					'Min score',
					'A real cosine similarity, so the cut-off is meaningful. Applied to the results already fetched — moving it does not re-run the search.',
					scoreCutoff.toFixed(2),
					cutoffControl
				)}
			{/if}
		</div>

		{#if offDefault > 0}
			<!-- The way back, pinned below the scroller so it is reachable without
			     first finding which of eight controls was left somewhere odd. -->
			<div class="border-t border-gray-100 px-3 py-2">
				<button
					type="button"
					onclick={reset}
					class="w-full cursor-pointer rounded-md border border-gray-200 py-1 text-xs font-medium text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-900"
				>
					Reset {offDefault} to default{offDefault === 1 ? '' : 's'}
				</button>
			</div>
		{/if}
	</div>
{/if}
