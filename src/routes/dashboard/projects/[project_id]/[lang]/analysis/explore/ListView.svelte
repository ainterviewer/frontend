<script lang="ts">
	import type { EmbeddingSearchHit } from '$lib/api/types.gen';
	import { format } from 'd3-format';
	import HitCard from './HitCard.svelte';
	import type { ListPaging } from './explore';

	let {
		hits,
		total,
		loading,
		error,
		paging,
		ranked,
		keyword,
		anchor,
		anchorLoading,
		onanchor,
		onclearanchor,
		railOpen,
		offDefault,
		onshowcontrols
	}: {
		hits: EmbeddingSearchHit[];
		/** Everything that matched, which the page is a slice of. */
		total: number | null;
		loading: boolean;
		error: string | null;
		paging: ListPaging;
		/**
		 * Whether these were ordered by a real score — a query's ranking or a
		 * walk's similarity to the anchor. A browse has neither, and a card
		 * showing a score would invite a reader to compare numbers that were
		 * never computed.
		 */
		ranked: boolean;
		/** The keyword narrowing the list, for the empty state to name. */
		keyword: string;
		/**
		 * The chunk these are the neighbours of, or null when the list is a
		 * query or the corpus. Its presence is what puts the list in the third
		 * of its three modes, and it is rendered above the results rather than
		 * inside them — it is what is being asked about, not one of the answers.
		 */
		anchor: EmbeddingSearchHit | null;
		/** An anchor asked for but not yet arrived, so the header can hold still. */
		anchorLoading: boolean;
		/** Walk to a chunk's neighbours. */
		onanchor: (hit: EmbeddingSearchHit) => void;
		/** Back to whatever the list was before the walk started. */
		onclearanchor: () => void;
		/**
		 * Whether the controls rail is showing. The map floats its own way back
		 * over an empty corner of the scatter; a mosaic has no empty corner, so
		 * the list carries one here instead — in the strip that already describes
		 * the results, rather than in the shared toolbar where it sat between the
		 * view toggle and the search box and belonged to neither.
		 */
		railOpen: boolean;
		/** How many settings are off default, for the badge on that button. */
		offDefault: number;
		onshowcontrols: () => void;
	} = $props();

	const formatNumber = format(',');

	/** Whether a walk is under way, including the beat before the anchor lands. */
	let walking = $derived(anchor !== null || anchorLoading);
</script>

<div class="flex min-h-0 min-w-0 flex-1 flex-col rounded-lg border border-gray-200 bg-white">
	<!-- What the list is, before it is read. A count alone cannot say whether
	     this is a ranking or the corpus in order, and the difference decides
	     whether the top of it means anything. -->
	<div
		class="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-gray-100 px-4 py-2 text-xs text-gray-500"
	>
		{#if !railOpen}
			<button
				type="button"
				onclick={onshowcontrols}
				aria-label="Show controls"
				title={offDefault > 0 ? `Controls — ${offDefault} away from default` : 'Controls'}
				class="flex cursor-pointer items-center gap-1 rounded-md border border-gray-200 px-1.5 py-0.5 font-medium text-gray-600 transition-colors hover:text-gray-900"
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
		{#if total !== null}
			<span>
				<span class="font-medium text-gray-700">{formatNumber(total)}</span>
				{total === 1 ? 'chunk' : 'chunks'}
			</span>
		{/if}
		<span>
			{#if walking}
				nearest this chunk
			{:else if ranked}
				ranked by similarity to the query
			{:else}
				in guide order — interview, then question
			{/if}
		</span>
		{#if walking}
			<!-- The way back, beside the label that says where you are. A walk
			     replaces the list under it rather than navigating away, so this
			     restores whatever was showing — a query's results, or the corpus. -->
			<button
				type="button"
				onclick={onclearanchor}
				class="cursor-pointer font-medium text-primary hover:underline"
			>
				Back to results
			</button>
		{/if}
		{#if loading}
			<span class="ml-auto flex items-center gap-1.5 text-gray-400">
				<i class="fa-solid fa-spinner fa-spin text-[0.625rem]"></i>
				Loading…
			</span>
		{/if}
	</div>

	<div class="min-h-0 flex-1 overflow-y-auto p-3">
		{#if anchor}
			<!-- Full width and outside the mosaic: the columns are a list of
			     answers, and this is the question they are answers to. Walking on
			     from a neighbour re-anchors, which is how a reader crosses the
			     corpus a step at a time. -->
			<div class="mb-3">
				<HitCard hit={anchor} showScore={false} anchored {onanchor} />
			</div>
		{:else if anchorLoading}
			<div class="mb-3 h-32 animate-pulse rounded-lg bg-gray-100"></div>
		{/if}

		{#if error && hits.length === 0}
			<p class="p-4 text-sm text-gray-500">{error}</p>
		{:else if loading && hits.length === 0}
			<!-- Uneven on purpose, and in the mosaic's own columns: a skeleton that
			     does not resemble what replaces it is a layout shift announced one
			     beat early. -->
			<div class="columns-1 gap-3 md:columns-2 2xl:columns-3">
				{#each [16, 26, 20, 32, 18, 24] as height, index (index)}
					<div
						class="mb-3 animate-pulse break-inside-avoid rounded-lg bg-gray-100"
						style="height:{height * 0.25}rem"
					></div>
				{/each}
			</div>
		{:else if hits.length === 0}
			<!-- Naming the narrowest thing first: a keyword is the likeliest
			     reason a corpus that plainly has content came back with none. -->
			<div class="px-4 py-10 text-center">
				<p class="text-sm font-medium text-gray-700">Nothing matched</p>
				<p class="mx-auto mt-1 max-w-md text-sm text-gray-500">
					{#if keyword.trim()}
						No respondent said “{keyword.trim()}” anywhere in the corpus these filters leave.
						Keyword matches the words people wrote, not the questions they were asked.
					{:else}
						No chunks of this unit match the filters.
					{/if}
				</p>
			</div>
		{:else}
			<!-- A mosaic rather than a column. The cards open expanded, so they are
			     tall and wildly uneven — a single column of them wastes most of a
			     wide screen and puts three chunks on a screenful. CSS columns is
			     the right masonry here precisely because the heights are unknown:
			     a grid would align rows and leave a ragged gap under every card
			     shorter than the tallest in its row.

			     The cost is reading order — down a column, then across, rather
			     than left to right. For a list in guide order that is the ordinary
			     newspaper reading and no worse than a long scroll; it would be
			     wrong for a ranking, which is why the count strip above says which
			     of the two this is. -->
			<div class="columns-1 gap-3 md:columns-2 2xl:columns-3">
				{#each hits as hit (hit.id)}
					<!-- `break-inside-avoid` is load-bearing: without it a card is
					     split down the middle across two columns. The margin does the
					     vertical spacing, since `gap` on a multi-column box is the
					     column gap only. -->
					<div class="mb-3 break-inside-avoid">
						<!-- No anchor offered on a row with no vector: browsing works on
						     an un-embedded corpus, but "what is nearest this" is a
						     question only a vector can answer, and the endpoint would
						     404. The button is absent rather than present and failing. -->
						<HitCard
							{hit}
							showScore={ranked}
							onanchor={hit.embedded === false ? undefined : onanchor}
						/>
					</div>
				{/each}
			</div>

			{#if paging.more}
				<div class="mt-3 flex flex-col items-center gap-1.5">
					<button
						type="button"
						onclick={paging.onmore}
						disabled={paging.moreLoading}
						class="cursor-pointer rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{paging.moreLoading ? 'Loading…' : 'Load more'}
					</button>
					{#if paging.moreError}
						<!-- Kept apart from the list's own error: a page that failed
						     leaves everything already on screen perfectly good. -->
						<p class="text-xs text-gray-500">{paging.moreError}</p>
					{/if}
				</div>
			{/if}
		{/if}
	</div>
</div>
