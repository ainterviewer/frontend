<script lang="ts">
	import type {
		EmbeddingCluster,
		EmbeddingGroup,
		EmbeddingSearchHit,
		EmbeddingSimilarResponse,
		EmbeddingSearchResponse,
		GroupKind
	} from '$lib/api/types.gen';
	import { mapColor } from '$lib/config/chartColors';
	import HoverInfo from '$lib/components/HoverInfo.svelte';
	import { format } from 'd3-format';
	import HitCard from './HitCard.svelte';
	import { GROUP_MODES, guideGroups } from './explore';

	let {
		clusters,
		groups,
		groupMode,
		multilingual,
		search,
		searchLoading,
		searchError,
		cutoffHiding,
		detail,
		detailLoading,
		detailError,
		selectedId,
		focusedGroup,
		onselect,
		onfocusgroup
	}: {
		clusters: EmbeddingCluster[];
		/** Every guide group the plotted points fall into, of both kinds. */
		groups: EmbeddingGroup[];
		groupMode: GroupKind;
		/**
		 * Whether the plotted corpus holds more than one language. On a
		 * single-language project every cluster is 100% one language, and a badge
		 * saying so on every row is noise standing exactly where a real warning
		 * would go.
		 */
		multilingual: boolean;
		search: EmbeddingSearchResponse | null;
		searchLoading: boolean;
		searchError: string | null;
		/**
		 * How many hits the score cut-off is holding back. An empty list because
		 * the reader raised a slider is a different thing from an empty list
		 * because nothing matched, and saying so is the difference between a
		 * control they understand and one that appears to have broken the search.
		 */
		cutoffHiding: number;
		detail: EmbeddingSimilarResponse | null;
		detailLoading: boolean;
		detailError: string | null;
		selectedId: string | null;
		/**
		 * The group picked out on the map, as `EmbeddingGroup.key` — a cluster id
		 * written out, guide coordinates, or a language code. One field for every
		 * grouping, because focusing is one act however the map is coloured.
		 */
		focusedGroup: string | null;
		onselect: (id: string | null) => void;
		onfocusgroup: (key: string | null) => void;
	} = $props();

	let listed = $derived(guideGroups(groups, groupMode));
	let modeLabel = $derived(
		GROUP_MODES.find((mode) => mode.value === groupMode)?.label ?? 'Clusters'
	);

	const formatNumber = format(',');
	const formatPercent = format('.0%');

	/**
	 * Where a purity stops describing a cluster and starts explaining it away.
	 * Below this the cluster spans the axis, which is what a theme looks like;
	 * at or above it, the axis *is* the cluster.
	 */
	const PURITY_WARNING = 0.8;

	function anchor(hit: EmbeddingSearchHit) {
		onselect(hit.id);
	}

	/** A predicate, so the notes below can print the figure without re-guarding it. */
	function high(purity: number | null | undefined): purity is number {
		return purity !== null && purity !== undefined && purity >= PURITY_WARNING;
	}

	// The scroller is reset when the anchor changes rather than left where it
	// was: re-anchoring from a neighbour halfway down the list would otherwise
	// leave the reader looking at a fresh list of neighbours with the chunk they
	// just chose scrolled off the top.
	let scroller = $state<HTMLDivElement | null>(null);
	$effect(() => {
		void selectedId;
		scroller?.scrollTo({ top: 0 });
	});
</script>

<!--
	How much of a cluster comes from one question, or one language.

	Always rendered where the API reports a figure, and always in the same shape
	for both axes: a chip that appears only above a threshold reads as missing
	data rather than as a low number, which is the opposite of what it means.
	Colour carries the severity instead — grey is a cluster that spans the axis,
	amber is one the axis has taken over.
-->
{#snippet purity(value: number | null | undefined, noun: string)}
	{#if value !== null && value !== undefined}
		<span
			class="rounded px-1.5 py-0.5 text-[0.6875rem] font-medium whitespace-nowrap"
			class:bg-amber-50={value >= PURITY_WARNING}
			class:text-amber-700={value >= PURITY_WARNING}
			class:bg-gray-100={value < PURITY_WARNING}
			class:text-gray-500={value < PURITY_WARNING}
		>
			{formatPercent(value)} one {noun}
		</span>
	{/if}
{/snippet}

<aside class="flex h-full min-h-0 flex-col rounded-lg border border-gray-200 bg-white">
	{#if selectedId}
		<!-- Chunk detail. One request produced all of this: `/similar` returns the
		     source as a full hit alongside its neighbours, so clicking a point on
		     the map never costs a second round trip to find out what it says. -->
		<header class="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
			<button
				type="button"
				onclick={() => onselect(null)}
				class="cursor-pointer text-xs font-medium text-gray-500 hover:text-gray-900"
			>
				<i class="fas fa-arrow-left mr-1"></i>Back
			</button>
			<h2 class="ml-auto text-xs font-semibold tracking-wide text-gray-400 uppercase">Chunk</h2>
		</header>

		<div bind:this={scroller} class="min-h-0 flex-1 overflow-y-auto px-4 py-3">
			{#if detailLoading}
				<div class="h-24 animate-pulse rounded-lg bg-gray-100"></div>
			{:else if detailError}
				<p class="text-sm text-gray-500">{detailError}</p>
			{:else if detail}
				<HitCard hit={detail.source} showScore={false} anchored />

				<h3 class="mt-5 mb-2 text-xs font-semibold tracking-wide text-gray-400 uppercase">
					Nearest neighbours
				</h3>
				{#if (detail.items ?? []).length === 0}
					<p class="text-sm text-gray-500">
						Nothing else of this kind is near it — which, with
						{formatNumber(detail.candidates ?? 0)} chunks in the filtered pool, is itself a finding.
					</p>
				{:else}
					<div class="flex flex-col gap-2">
						{#each detail.items ?? [] as neighbour (neighbour.id)}
							<HitCard hit={neighbour} onanchor={anchor} />
						{/each}
					</div>
				{/if}
			{/if}
		</div>
	{:else if search || searchLoading || searchError}
		<header class="border-b border-gray-100 px-4 py-3">
			<h2 class="text-xs font-semibold tracking-wide text-gray-400 uppercase">Results</h2>
			{#if search}
				<p class="mt-0.5 text-xs text-gray-500">
					{formatNumber((search.items ?? []).length)} of
					{formatNumber(search.candidates ?? 0)} chunks scored
				</p>
			{/if}
		</header>

		<div class="min-h-0 flex-1 overflow-y-auto px-4 py-3">
			{#if searchLoading}
				<div class="flex flex-col gap-2">
					{#each [0, 1, 2] as row (row)}
						<div class="h-20 animate-pulse rounded-lg bg-gray-100"></div>
					{/each}
				</div>
			{:else if searchError}
				<p class="text-sm text-gray-500">{searchError}</p>
			{:else if search && (search.items ?? []).length === 0}
				<!-- The distinction the endpoint exists to make. An empty list with
				     nothing scored is a filter that left nothing to search; an empty
				     list with thousands scored is a query nothing answers. -->
				<p class="text-sm text-gray-500">
					{#if cutoffHiding > 0}
						{formatNumber(cutoffHiding)}
						{cutoffHiding === 1 ? 'result is' : 'results are'} below the score cut-off. Lower it to see
						{cutoffHiding === 1 ? 'it' : 'them'}.
					{:else if (search.candidates ?? 0) === 0}
						Your filters left nothing to search. Widen them and try again.
					{:else}
						Nothing matched, out of {formatNumber(search.candidates ?? 0)} chunks scored.
					{/if}
				</p>
			{:else if search}
				<div class="flex flex-col gap-2">
					{#each search.items ?? [] as hit (hit.id)}
						<HitCard {hit} onanchor={anchor} />
					{/each}
				</div>
			{/if}
		</div>
	{:else if groupMode !== 'cluster'}
		<!-- Declared groups. Unlike a cluster these arrive named, and there is
		     nothing to read to find out what they are — so a row is a legend
		     entry and a way to pick its points out of the map, not a card. -->
		<header class="border-b border-gray-100 px-4 py-3">
			<h2
				class="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-gray-400 uppercase"
			>
				{modeLabel}
				<HoverInfo
					text={groupMode === 'language'
						? 'The language each interview was conducted in, as recorded on the interview rather than detected from the text.'
						: "Taken from the project's default guide, matched to each chunk by the position it was asked in. A question the guide no longer has keeps its number and loses its wording."}
				/>
			</h2>
		</header>

		<div class="min-h-0 flex-1 overflow-y-auto px-4 py-3">
			{#if listed.length === 0}
				<p class="text-sm text-gray-500">
					{groupMode === 'language'
						? 'No languages are listed for the plotted chunks.'
						: 'None of the plotted chunks carry guide coordinates, so there is nothing to group them by. Interview-level chunks span the whole guide and have none.'}
				</p>
			{:else}
				<div class="flex flex-col gap-1">
					{#each listed as group, index (group.key)}
						{@const open = focusedGroup === group.key}
						<button
							type="button"
							onclick={() => onfocusgroup(open ? null : group.key)}
							class="flex w-full cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-left"
							class:border-primary={open}
							class:border-transparent={!open}
							class:hover:border-gray-200={!open}
						>
							<span
								class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
								style="background:{mapColor(index)}"
							></span>
							<span class="min-w-0 flex-1">
								<span class="flex items-baseline gap-2">
									<span class="text-sm font-medium text-gray-800">{group.label}</span>
									<span class="text-xs text-gray-400">{formatNumber(group.size)} chunks</span>
								</span>
								{#if group.text}
									<span class="mt-0.5 block text-xs text-gray-500">{group.text}</span>
								{/if}
							</span>
						</button>
					{/each}
				</div>
			{/if}
		</div>
	{:else}
		<header class="border-b border-gray-100 px-4 py-3">
			<h2
				class="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-gray-400 uppercase"
			>
				Clusters
				<HoverInfo
					text="HDBSCAN has no names for what it finds, so a cluster is an id and the chunks nearest its centre. Read those to name it."
				/>
			</h2>
		</header>

		<div class="min-h-0 flex-1 overflow-y-auto px-4 py-3">
			{#if clusters.length === 0}
				<p class="text-sm text-gray-500">
					No clusters at this setting — every chunk was left unplaced. Lower the minimum cluster
					size.
				</p>
			{:else}
				<div class="flex flex-col gap-2">
					{#each clusters as cluster (cluster.id)}
						{@const open = focusedGroup === String(cluster.id)}
						<div class="rounded-lg border border-gray-200">
							<button
								type="button"
								onclick={() => onfocusgroup(open ? null : String(cluster.id))}
								class="flex w-full cursor-pointer items-start gap-2 px-3 py-2 text-left"
							>
								<span
									class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
									style="background:{mapColor(cluster.id)}"
								></span>
								<span class="min-w-0 flex-1">
									<span class="flex items-baseline gap-2">
										<span class="text-sm font-medium text-gray-800">Cluster {cluster.id}</span>
										<span class="text-xs text-gray-400">{formatNumber(cluster.size)} chunks</span>
									</span>
									<!-- Both purities on a line of their own. Two of them will not
									     fit beside the name in this panel, and reading them as a
									     pair is the point anyway: a cluster that is low on both is
									     a theme, and one that is high on either is the axis it is
									     high on. -->
									<span class="mt-1 flex flex-wrap items-center gap-1">
										{@render purity(cluster.question_purity, 'question')}
										{#if multilingual}
											{@render purity(cluster.language_purity, 'language')}
										{/if}
									</span>
								</span>
								<i
									class="fas fa-chevron-down mt-1 shrink-0 text-[0.625rem] text-gray-300 transition-transform"
									class:rotate-180={open}
								></i>
							</button>

							{#if open}
								<div class="flex flex-col gap-2 border-t border-gray-100 px-3 py-2">
									{#if high(cluster.question_purity)}
										<p class="text-xs text-amber-700">
											{formatPercent(cluster.question_purity)} of these come from the same interview question.
											This cluster is a question, not a theme — try centring by question.
										</p>
									{/if}
									{#if multilingual && high(cluster.language_purity)}
										<p class="text-xs text-amber-700">
											{formatPercent(cluster.language_purity)} of these were answered in the same language.
											This cluster may be a language rather than a theme — try centring by language.
										</p>
									{/if}
									{#each cluster.representatives ?? [] as representative (representative.id)}
										<HitCard hit={representative} showScore={false} onanchor={anchor} />
									{/each}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</aside>
