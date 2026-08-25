<script lang="ts">
	import { Pagination } from 'bits-ui';

	let {
		rowCount,
		pageIndex,
		pageSize,
		pageSizes = [10, 25, 50, 100],
		selectedCount = 0,
		onPageChange,
		onPageSizeChange
	}: {
		rowCount: number;
		/** Zero-based, as TanStack reports it. */
		pageIndex: number;
		pageSize: number;
		pageSizes?: number[];
		selectedCount?: number;
		onPageChange: (pageIndex: number) => void;
		onPageSizeChange: (pageSize: number) => void;
	} = $props();

	const from = $derived(rowCount === 0 ? 0 : pageIndex * pageSize + 1);
	const to = $derived(Math.min(rowCount, (pageIndex + 1) * pageSize));

	const navButton =
		'flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-secondary/40 hover:text-dark focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent';
</script>

<div
	class="flex shrink-0 flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-gray-200 px-4 py-3 text-sm text-gray-600"
>
	<p>
		{from}–{to} of {rowCount}
		{#if selectedCount > 0}
			<span class="text-gray-400">·</span>
			<span class="font-medium text-primary">{selectedCount} selected</span>
		{/if}
	</p>

	<div class="flex items-center gap-5">
		<label class="flex items-center gap-2">
			<span class="whitespace-nowrap text-gray-500">Rows per page</span>
			<select
				class="rounded-md border border-gray-300 py-1 pr-7 pl-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary/20 focus:outline-none"
				value={pageSize}
				onchange={(e) => onPageSizeChange(Number(e.currentTarget.value))}
			>
				{#each pageSizes as size (size)}
					<option value={size}>{size}</option>
				{/each}
			</select>
		</label>

		<!-- bits-ui Pagination is 1-based; TanStack's pageIndex is 0-based. -->
		<Pagination.Root
			count={rowCount}
			perPage={pageSize}
			page={pageIndex + 1}
			onPageChange={(page) => onPageChange(page - 1)}
		>
			{#snippet children({ pages, currentPage })}
				<div class="flex items-center gap-0.5">
					<Pagination.PrevButton class={navButton} aria-label="Previous page">
						<i class="fa-solid fa-chevron-left text-xs"></i>
					</Pagination.PrevButton>
					{#each pages as page (page.key)}
						{#if page.type === 'ellipsis'}
							<span class="px-1.5 text-gray-400">&hellip;</span>
						{:else}
							<Pagination.Page
								{page}
								class="flex h-8 min-w-8 items-center justify-center rounded-md px-2 tabular-nums focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none {currentPage ===
								page.value
									? 'bg-primary font-semibold text-on-primary'
									: 'text-gray-600 hover:bg-secondary/40 hover:text-dark'}"
							>
								{page.value}
							</Pagination.Page>
						{/if}
					{/each}
					<Pagination.NextButton class={navButton} aria-label="Next page">
						<i class="fa-solid fa-chevron-right text-xs"></i>
					</Pagination.NextButton>
				</div>
			{/snippet}
		</Pagination.Root>
	</div>
</div>
