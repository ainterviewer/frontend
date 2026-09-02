<script lang="ts">
	import type { EmbeddingKind, GroupKind, InterviewStatus, Projection } from '$lib/api/types.gen';
	import HoverInfo from '$lib/components/HoverInfo.svelte';
	import { Switch } from 'bits-ui';
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
		defaultFilters
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
		includeSynthetic = $bindable(),
		scoreCutoff = $bindable(),
		searching,
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
		includeSynthetic: boolean;
		scoreCutoff: number;
		/** Whether a search is up, which is the only time a score cut-off means anything. */
		searching: boolean;
		/**
		 * Whether the plotted corpus holds more than one language. Centring on
		 * language is a real choice only where there is more than one to centre;
		 * on a single-language corpus it subtracts one mean from everything.
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
		includeSynthetic = defaultFilters().include_synthetic;
	}

	let clustering = $derived(groupMode === 'cluster');
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
