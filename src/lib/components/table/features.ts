import {
	columnFacetingFeature,
	columnFilteringFeature,
	columnVisibilityFeature,
	createFacetedRowModel,
	createFacetedUniqueValues,
	createFilteredRowModel,
	createPaginatedRowModel,
	createSortedRowModel,
	filterFn_includesString,
	globalFilteringFeature,
	rowPaginationFeature,
	rowSelectionFeature,
	rowSortingFeature,
	sortFn_basic,
	sortFn_text,
	tableFeatures
} from '@tanstack/svelte-table';

/**
 * The one feature set every dashboard table registers.
 *
 * Registering the same slots everywhere is what lets `DataTable` read
 * `table.atoms.pagination`, `.globalFilter` and `.columnFilters` without
 * guarding each one: TanStack only creates a state slice when its feature is
 * registered, so a table missing `rowPaginationFeature` would have no
 * `atoms.pagination` at all. Whether a table *shows* search, filters or
 * pagination is a `DataTable` prop, not a registration decision.
 */
export const dataTableFeatures = tableFeatures({
	columnFilteringFeature,
	globalFilteringFeature,
	filteredRowModel: createFilteredRowModel(),
	filterFns: { includesString: filterFn_includesString },
	columnFacetingFeature,
	facetedRowModel: createFacetedRowModel(),
	facetedUniqueValues: createFacetedUniqueValues(),
	rowSortingFeature,
	sortedRowModel: createSortedRowModel(),
	sortFns: { text: sortFn_text, basic: sortFn_basic },
	columnVisibilityFeature,
	rowSelectionFeature,
	rowPaginationFeature,
	paginatedRowModel: createPaginatedRowModel()
});

export type DataTableFeatures = typeof dataTableFeatures;

/**
 * Initial pagination for a table that shows every row.
 *
 * This has to live in `initialState` rather than be applied by an effect:
 * effects never run during SSR, so a server-rendered table would ship the
 * default page of 10 rows and only correct itself after hydration. `DataTable`
 * reads the page size back to decide whether to render page controls, so this
 * stays the single source of truth. Infinity is TanStack's own opt-out
 * sentinel -- the paginated row model skips slicing entirely.
 */
export const NO_PAGINATION = { pageIndex: 0, pageSize: Infinity };

/** Blank text sorts as undefined so `sortUndefined: 'last'` keeps it at the bottom. */
export const sortableText = (value: string | null | undefined) => value || undefined;

/** Dates sort numerically; render the cell from `row.original` instead. */
export const sortableTime = (value: string | null | undefined) =>
	value ? new Date(value).getTime() : undefined;

/**
 * Matches a stringified cell value against the selections `FacetedFilter`
 * produces. Pass it directly as a column's `filterFn`.
 */
export function matchesSelection(
	row: { getValue: (columnId: string) => unknown },
	columnId: string,
	filterValue: unknown
) {
	const selected = filterValue as string[] | undefined;
	if (!selected?.length) return true;
	const value = row.getValue(columnId);
	return selected.includes(value === null || value === undefined ? '' : String(value));
}

/** Compact enough to keep date columns narrow; seconds live in the title. */
export function formatDate(s: string | null | undefined) {
	if (!s) return '';
	return new Date(s)
		.toLocaleString('en-GB', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			hour12: false
		})
		.replace(',', '');
}

export function formatDateFull(s: string | null | undefined) {
	return s ? new Date(s).toLocaleString('en-GB', { hour12: false }) : '';
}

/** One value a server-side facet offers, as the API returns it. */
export type Facet = { value: string; count: number };

/** A server facet as the `counts` map `FacetedFilter` takes. */
export function facetCounts(facet: Facet[] | undefined): Record<string, number> {
	return Object.fromEntries((facet ?? []).map(({ value, count }) => [value, count]));
}

/**
 * A server facet as `FacetedFilter` choices, optionally relabelled.
 *
 * Deriving the options from the facet rather than from the enum means the
 * dropdown only ever lists values the data actually contains.
 */
export function facetOptions(
	facet: Facet[] | undefined,
	labels: Record<string, string> = {}
): { value: string; label: string }[] {
	return (facet ?? []).map(({ value }) => ({ value, label: labels[value] ?? value }));
}

/**
 * The value `DateRangeFilter` stores on its column, as the two `YYYY-MM-DD`
 * strings a native date input produces. Both ends are optional.
 */
export type DateRange = { from?: string; to?: string };

/**
 * A `DateRange` as the two timestamps the API takes.
 *
 * The bounds are built in local time and sent as UTC: the user picked days off
 * a calendar, so the last day has to run to its own midnight rather than stop
 * at 00:00 and drop everything recorded during it.
 */
export function dateRangeQuery(range: DateRange | undefined) {
	return {
		created_from: range?.from ? new Date(`${range.from}T00:00:00`).toISOString() : undefined,
		created_to: range?.to ? new Date(`${range.to}T23:59:59.999`).toISOString() : undefined
	};
}

/** Per-column presentation, read by `DataTable` from `columnDef.meta`. */
export type ColumnMeta = {
	/** Extra classes for this column's body cells. */
	class?: string;
	align?: 'left' | 'right' | 'center';
	/**
	 * Draws a dashed separator down this column's left edge, through every
	 * header row and every body row. Set it on a column group and on that
	 * group's first leaf so the line runs unbroken.
	 */
	groupStart?: boolean;
};
