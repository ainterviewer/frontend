<script lang="ts" generics="TData">
	import type { Snippet } from 'svelte';
	import ColumnHeader from './ColumnHeader.svelte';
	import ColumnVisibility from './ColumnVisibility.svelte';
	import SearchInput from './SearchInput.svelte';
	import TablePagination from './TablePagination.svelte';
	import type { ColumnMeta } from './features';

	/**
	 * Structural views of the TanStack API this component touches. Declaring them
	 * structurally keeps the component free of the feature generics, which gate
	 * the real Table/Row/Column types per registered feature.
	 */
	interface ColumnLike {
		id: string;
		columnDef: { header?: unknown; meta?: ColumnMeta };
		getCanSort: () => boolean;
		getIsSorted: () => false | 'asc' | 'desc';
		toggleSorting: (desc?: boolean) => void;
		clearSorting: () => void;
		getCanHide: () => boolean;
		getIsVisible: () => boolean;
		toggleVisibility: (value?: boolean) => void;
	}

	interface RowLike {
		id: string;
		original: TData;
		getIsSelected: () => boolean;
		getToggleSelectedHandler: () => (event: unknown) => void;
		getVisibleCells: () => { id: string; column: ColumnLike }[];
	}

	interface HeaderLike {
		id: string;
		column: ColumnLike;
		colSpan: number;
		/** 0 means this header is merged into one rendered above it. */
		rowSpan: number;
		isPlaceholder: boolean;
		subHeaders: unknown[];
	}

	interface TableLike {
		getHeaderGroups: () => { id: string; headers: HeaderLike[] }[];
		getRowModel: () => { rows: RowLike[] };
		getFilteredRowModel: () => { rows: unknown[] };
		getAllLeafColumns: () => ColumnLike[];
		getVisibleLeafColumns: () => unknown[];
		getIsAllPageRowsSelected: () => boolean;
		getIsSomePageRowsSelected: () => boolean;
		getToggleAllPageRowsSelectedHandler: () => (event: unknown) => void;
		getSelectedRowIds: () => string[];
		resetRowSelection: (defaultState?: boolean) => void;
		setGlobalFilter: (value: unknown) => void;
		resetColumnFilters: () => void;
		setPageIndex: (index: number) => void;
		setPageSize: (size: number) => void;
		atoms: {
			pagination: { get: () => { pageIndex: number; pageSize: number } };
			globalFilter: { get: () => unknown };
			columnFilters: { get: () => unknown[] };
		};
	}

	let {
		table,
		columnLabels,
		cell,
		title = '',
		loading = false,
		hasLoaded = true,
		selectable = true,
		search = false,
		searchPlaceholder = 'Search...',
		rowCount,
		emptyTitle = 'Nothing here yet',
		emptyDescription = '',
		rowLabel = 'row',
		filters,
		selectionActions,
		toolbar,
		onRowClick,
		isExpanded,
		expandedRow
	}: {
		table: TableLike;
		/** Column id to visible name, for the Columns menu. */
		columnLabels: Record<string, string>;
		/** Renders the content of every cell except the selection checkbox. */
		cell: Snippet<[string, RowLike]>;
		/** Optional heading bar, for pages showing more than one table. */
		title?: string;
		loading?: boolean;
		hasLoaded?: boolean;
		selectable?: boolean;
		search?: boolean;
		searchPlaceholder?: string;
		/**
		 * Total rows across the whole dataset. Required with server-side
		 * pagination, where the client only holds the current page.
		 */
		rowCount?: number;
		emptyTitle?: string;
		emptyDescription?: string;
		/** Noun used in the selection readout, e.g. "participant". */
		rowLabel?: string;
		/** Faceted filters for the control row. */
		filters?: Snippet;
		/** Actions shown beside the selected-row count. */
		selectionActions?: Snippet;
		/** Extra controls at the right of the control row, before Columns. */
		toolbar?: Snippet;
		/**
		 * Makes whole rows activatable. Clicks and keystrokes that originate on a
		 * control inside a cell are left to that control.
		 */
		onRowClick?: (row: RowLike) => void;
		/** Whether this row's detail panel is open. Pair with `expandedRow`. */
		isExpanded?: (row: RowLike) => boolean;
		/** Detail panel rendered as a full-width row beneath an expanded row. */
		expandedRow?: Snippet<[RowLike]>;
	} = $props();

	/**
	 * Clicking a row runs the page's handler when it has one, and otherwise
	 * toggles selection, with shift extending the range.
	 */
	const rowsClickable = $derived(!!onRowClick || selectable);

	/**
	 * A cell that carries its own control handles its own clicks and keystrokes.
	 * Checking the target here means a page can put a button or an input in a
	 * cell without remembering to stop propagation on every one of them.
	 */
	function fromOwnControl(event: Event) {
		const target = event.target as HTMLElement | null;
		return !!target?.closest('button, input, select, textarea, a, label, [role="menuitem"]');
	}

	function activateRow(row: RowLike, event: Event) {
		if (onRowClick) {
			onRowClick(row);
			return;
		}
		if (!selectable) return;
		// TanStack's handler reads `event.target.checked` and, for a shift-click,
		// applies that same value across the range. A click on a <tr> has no
		// checked target, and passing the event raw would hand the range
		// `undefined` -- which clears it instead of extending the selection.
		row.getToggleSelectedHandler()({
			target: { checked: !row.getIsSelected() },
			shiftKey: (event as MouseEvent | KeyboardEvent).shiftKey
		});
	}

	const rows = $derived(table.getRowModel().rows);
	const filteredCount = $derived(table.getFilteredRowModel().rows.length);
	/** The server's count wins when it is supplied; otherwise count the client rows. */
	const total = $derived(rowCount ?? filteredCount);
	const visibleColumnCount = $derived(table.getVisibleLeafColumns().length);
	const selectedIds = $derived(selectable ? table.getSelectedRowIds() : []);
	const globalFilter = $derived((table.atoms.globalFilter.get() as string | undefined) ?? '');
	const columnFilters = $derived(table.atoms.columnFilters.get());
	const page = $derived(table.atoms.pagination.get());
	const hasFilters = $derived(globalFilter !== '' || columnFilters.length > 0);
	// Whether to page is read off the table's own state (see NO_PAGINATION), so
	// there is nothing for SSR and hydration to disagree about.
	const paginated = $derived(page.pageSize !== Infinity);
	const hasControls = $derived(search || !!filters || !!toolbar);

	function clearFilters() {
		table.setGlobalFilter('');
		table.resetColumnFilters();
	}

	/**
	 * TanStack fills in a default `header` *function* for columns that declare
	 * none, so only a string is a real label; anything else falls back to the
	 * Columns-menu label, then to blank.
	 */
	function headerLabel(column: ColumnLike) {
		const header = column.columnDef.header;
		return typeof header === 'string' ? header : (columnLabels[column.id] ?? '');
	}

	/** An unbroken dashed rule down a column-group boundary. */
	function separatorClass(meta?: ColumnMeta) {
		return meta?.groupStart ? 'border-l border-dashed border-dark/20' : '';
	}

	function alignClass(meta?: ColumnMeta) {
		return meta?.align === 'right' ? 'text-right' : meta?.align === 'center' ? 'text-center' : '';
	}

	/**
	 * Header rows stick to the top of the scrolling row area, each one below the
	 * one above it. The offsets are measured rather than assumed because a
	 * grouped header has two rows of different heights, and a second row pinned
	 * at 0 would sit on top of the first instead of under it.
	 */
	let headerHeights = $state<number[]>([]);

	function stickyTop(groupIndex: number) {
		let top = 0;
		for (let i = 0; i < groupIndex; i++) top += headerHeights[i] ?? 0;
		return top;
	}

	/**
	 * Sticky cells carry their own background, since the row's does not travel
	 * with them, and their own bottom rule: with `border-collapse: collapse` the
	 * borders belong to the table and stay behind when a cell is pinned.
	 */
	const stickyHeaderCell = 'sticky z-10 bg-secondary shadow-[inset_0_-1px_0_rgb(28_40_38/0.1)]';
</script>

<!-- The card is a flex column so the rows can be the only thing that scrolls,
     leaving the controls, the header and the pagination bar always in reach.
     It is capped, not stretched: it takes the height its rows need, and only
     once that would outgrow `--table-max-h` (set by the dashboard layout) does
     it stop there and scroll the rows inside instead. Growing to fill would
     strand the footer under a wall of white on a short table, and would make
     two tables on one page fight over a single viewport rather than each
     taking what it needs. -->
<div
	class="flex max-h-[var(--table-max-h,100vh)] shrink-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
>
	{#if title}
		<div class="shrink-0 border-b border-gray-200 px-4 py-3">
			<h3 class="text-sm font-semibold text-dark">{title}</h3>
		</div>
	{/if}

	{#if hasControls}
		<div class="flex shrink-0 flex-wrap items-center gap-2 px-4 py-3">
			{#if search}
				<SearchInput
					value={globalFilter}
					onChange={(value) => table.setGlobalFilter(value)}
					placeholder={searchPlaceholder}
					class="w-full sm:w-72"
				/>
			{/if}
			{@render filters?.()}
			{#if hasFilters}
				<button
					class="rounded-md px-2 py-1.5 text-sm text-gray-500 hover:text-dark focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
					onclick={clearFilters}
				>
					<i class="fa-solid fa-xmark mr-1"></i> Clear filters
				</button>
			{/if}
			<div class="ml-auto flex items-center gap-2">
				{#if selectable && selectedIds.length > 0}
					<!-- Kept in this row rather than a strip of its own, so toggling a
					     selection never shifts the table vertically. -->
					<div
						class="flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 py-1 pr-1 pl-2.5 text-sm"
					>
						<span class="font-medium whitespace-nowrap text-dark">
							{selectedIds.length} selected
						</span>
						{@render selectionActions?.()}
						<button
							class="flex h-6 w-6 items-center justify-center rounded text-gray-500 hover:bg-dark/5 hover:text-dark focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
							onclick={() => table.resetRowSelection(true)}
							title="Clear selection"
							aria-label="Clear selection"
						>
							<i class="fa-solid fa-xmark"></i>
						</button>
					</div>
				{/if}
				{@render toolbar?.()}
				<ColumnVisibility columns={table.getAllLeafColumns()} labels={columnLabels} />
			</div>
		</div>
	{/if}

	<div class="min-h-0 grow overflow-auto {hasControls ? 'border-t border-gray-200' : ''}">
		<table class="min-w-full">
			<thead>
				{#each table.getHeaderGroups() as headerGroup, groupIndex (headerGroup.id)}
					<tr
						bind:clientHeight={headerHeights[groupIndex]}
						class="border-b border-dark/10 text-left text-[13px] tracking-wide text-dark uppercase"
					>
						{#each headerGroup.headers as header (header.id)}
							<!-- rowSpan 0 means this header was merged into one rendered in
							     an earlier row, so it must be skipped entirely. Everything
							     else renders its column's content and span, INCLUDING
							     placeholders: the placeholder at the top of a chain is the
							     cell that carries a shallow column across the header rows. -->
							{#if header.rowSpan !== 0}
								{#if selectable && header.column.id === 'select'}
									<!-- align-bottom so a merged select-all lines up with the leaf
									     header row rather than floating between the two. -->
									<th
										class="w-10 px-4 py-3 align-bottom {stickyHeaderCell}"
										style="top: {stickyTop(groupIndex)}px"
										rowspan={header.rowSpan}
									>
										<input
											type="checkbox"
											class="form-checkbox h-4 w-4 cursor-pointer rounded border-gray-400 text-primary focus:ring-primary"
											checked={table.getIsAllPageRowsSelected()}
											indeterminate={table.getIsSomePageRowsSelected() &&
												!table.getIsAllPageRowsSelected()}
											onclick={table.getToggleAllPageRowsSelectedHandler()}
											aria-label="Select all"
										/>
									</th>
								{:else if !header.isPlaceholder && header.subHeaders.length > 0}
									<!-- A spanning group header: a label, not a sortable column.
									     The isPlaceholder guard matters -- a placeholder standing in
									     for a shallow column also reports subHeaders, and must render
									     as its own sortable column, not as a group label. -->
									<th
										colspan={header.colSpan}
										rowspan={header.rowSpan}
										class="px-4 py-3 text-center font-semibold text-dark {stickyHeaderCell} {separatorClass(
											header.column.columnDef.meta
										)}"
										style="top: {stickyTop(groupIndex)}px"
									>
										{headerLabel(header.column)}
									</th>
								{:else}
									<ColumnHeader
										label={headerLabel(header.column)}
										column={header.column}
										align={header.column.columnDef.meta?.align === 'right' ? 'right' : 'left'}
										colspan={header.colSpan}
										rowspan={header.rowSpan}
										top={stickyTop(groupIndex)}
										class="{stickyHeaderCell} {separatorClass(header.column.columnDef.meta)}"
									/>
								{/if}
							{/if}
						{/each}
					</tr>
				{/each}
			</thead>
			<tbody>
				{#if loading && !hasLoaded}
					<tr>
						<td colspan={visibleColumnCount} class="px-4 py-16 text-center text-gray-500">
							<i class="fa-solid fa-spinner fa-spin mr-2"></i> Loading...
						</td>
					</tr>
				{:else if total === 0 && !hasFilters}
					<tr>
						<td colspan={visibleColumnCount} class="px-4 py-16 text-center">
							<p class="font-medium text-dark">{emptyTitle}</p>
							{#if emptyDescription}
								<p class="mt-1 text-sm text-gray-500">{emptyDescription}</p>
							{/if}
						</td>
					</tr>
				{:else if rows.length === 0}
					<tr>
						<td colspan={visibleColumnCount} class="px-4 py-16 text-center">
							{#if hasFilters}
								<p class="font-medium text-dark">No {rowLabel}s match these filters</p>
								<button
									class="mt-2 text-sm text-primary underline hover:brightness-110"
									onclick={clearFilters}
								>
									Clear filters
								</button>
							{:else}
								<!-- Rows exist but not on this page: a server-side page index left
								     behind by a delete, or by data that shrank under it. -->
								<p class="font-medium text-dark">This page is empty</p>
								<button
									class="mt-2 text-sm text-primary underline hover:brightness-110"
									onclick={() => table.setPageIndex(0)}
								>
									Back to the first page
								</button>
							{/if}
						</td>
					</tr>
				{:else}
					{#each rows as row (row.id)}
						{@const selected = row.getIsSelected()}
						<tr
							class="border-b border-gray-100 text-sm last:border-0 {selected
								? 'bg-primary/5'
								: 'hover:bg-secondary/20'} {rowsClickable ? 'cursor-pointer' : ''}"
							tabindex={rowsClickable ? 0 : undefined}
							onclick={rowsClickable
								? (e) => {
										if (fromOwnControl(e)) return;
										activateRow(row, e);
									}
								: undefined}
							onkeydown={rowsClickable
								? (e) => {
										// Only keystrokes aimed at the row itself: a space typed into
										// an inline editor must reach the input, not be swallowed here.
										if (e.target !== e.currentTarget) return;
										if (e.key === 'Enter' || e.key === ' ') {
											e.preventDefault();
											activateRow(row, e);
										}
									}
								: undefined}
						>
							{#each row.getVisibleCells() as visibleCell (visibleCell.id)}
								{#if selectable && visibleCell.column.id === 'select'}
									<td class="px-4 py-2.5">
										<!-- Bound to click, not change: the handler needs the shift key from
										     the original event to extend a range. -->
										<input
											type="checkbox"
											class="form-checkbox h-4 w-4 cursor-pointer rounded border-gray-400 text-primary focus:ring-primary"
											checked={selected}
											onclick={(e) => {
												e.stopPropagation();
												row.getToggleSelectedHandler()(e);
											}}
											aria-label="Select {rowLabel}"
										/>
									</td>
								{:else}
									<td
										class="px-4 py-2.5 {alignClass(
											visibleCell.column.columnDef.meta
										)} {separatorClass(visibleCell.column.columnDef.meta)} {visibleCell.column
											.columnDef.meta?.class ?? ''}"
									>
										{@render cell(visibleCell.column.id, row)}
									</td>
								{/if}
							{/each}
						</tr>
						{#if expandedRow && isExpanded?.(row)}
							<tr class="border-b border-gray-100 bg-gray-50/70">
								<td colspan={visibleColumnCount} class="px-4 py-4">
									{@render expandedRow(row)}
								</td>
							</tr>
						{/if}
					{/each}
				{/if}
			</tbody>
		</table>
	</div>

	{#if hasLoaded && total > 0}
		{#if !paginated}
			<!-- No page controls, but the count still belongs somewhere. -->
			<div class="shrink-0 border-t border-gray-200 px-4 py-3 text-sm text-gray-600">
				{total}
				{total === 1 ? rowLabel : `${rowLabel}s`}
				{#if selectable && selectedIds.length > 0}
					<span class="text-gray-400">·</span>
					<span class="font-medium text-primary">{selectedIds.length} selected</span>
				{/if}
			</div>
		{:else}
			<TablePagination
				rowCount={total}
				pageIndex={page.pageIndex}
				pageSize={page.pageSize}
				selectedCount={selectedIds.length}
				onPageChange={(index) => table.setPageIndex(index)}
				onPageSizeChange={(size) => table.setPageSize(size)}
			/>
		{/if}
	{/if}
</div>
