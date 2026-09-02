<script lang="ts">
	import type {
		EmbeddingCluster,
		EmbeddingSearchHit,
		EmbeddingSimilarResponse,
		EmbeddingSearchResponse
	} from '$lib/api/types.gen';
	import { clusterColor } from '$lib/config/chartColors';
	import HoverInfo from '$lib/components/HoverInfo.svelte';
	import { format } from 'd3-format';
	import HitCard from './HitCard.svelte';

	let {
		clusters,
		search,
		searchLoading,
		searchError,
		cutoffHiding,
		detail,
		detailLoading,
		detailError,
		selectedId,
		focusedCluster,
		onselect,
		onfocuscluster
	}: {
		clusters: EmbeddingCluster[];
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
		focusedCluster: number | null;
		onselect: (id: string | null) => void;
		onfocuscluster: (cluster: number | null) => void;
	} = $props();

	const formatNumber = format(',');
	const formatPercent = format('.0%');

	function anchor(hit: EmbeddingSearchHit) {
		onselect(hit.id);
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
						{@const open = focusedCluster === cluster.id}
						<div class="rounded-lg border border-gray-200">
							<button
								type="button"
								onclick={() => onfocuscluster(open ? null : cluster.id)}
								class="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left"
							>
								<span
									class="h-2.5 w-2.5 shrink-0 rounded-full"
									style="background:{clusterColor(cluster.id)}"
								></span>
								<span class="text-sm font-medium text-gray-800">Cluster {cluster.id}</span>
								<span class="text-xs text-gray-400">{formatNumber(cluster.size)} chunks</span>

								{#if cluster.question_purity !== null && cluster.question_purity !== undefined}
									<!-- The number that decides whether the cluster is worth
									     reading at all. Near 1.0 it has grouped one interview
									     question rather than one idea, and the only thing it tells
									     you is which question. -->
									<span
										class="ml-auto rounded px-1.5 py-0.5 text-[0.6875rem] font-medium"
										class:bg-amber-50={cluster.question_purity >= 0.8}
										class:text-amber-700={cluster.question_purity >= 0.8}
										class:bg-gray-100={cluster.question_purity < 0.8}
										class:text-gray-500={cluster.question_purity < 0.8}
									>
										{formatPercent(cluster.question_purity)} one question
									</span>
								{/if}
								<i
									class="fas fa-chevron-down ml-1 text-[0.625rem] text-gray-300 transition-transform"
									class:rotate-180={open}
								></i>
							</button>

							{#if open}
								<div class="flex flex-col gap-2 border-t border-gray-100 px-3 py-2">
									{#if cluster.question_purity !== null && cluster.question_purity !== undefined && cluster.question_purity >= 0.8}
										<p class="text-xs text-amber-700">
											{formatPercent(cluster.question_purity)} of these come from the same interview question.
											This cluster is a question, not a theme — try centring by question.
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
