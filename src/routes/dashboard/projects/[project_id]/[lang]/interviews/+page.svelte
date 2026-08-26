<script lang="ts">
	import { replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Projects as Api } from '$lib/api';
	import type {
		InterviewFacets,
		InterviewStatus,
		InterviewSummaryPublic
	} from '$lib/api/types.gen';
	import DemoRestrictionOverlay from '$lib/components/DemoRestrictionOverlay.svelte';
	import DataTable from '$lib/components/table/DataTable.svelte';
	import DateRangeFilter from '$lib/components/table/DateRangeFilter.svelte';
	import FacetedFilter from '$lib/components/table/FacetedFilter.svelte';
	import {
		dataTableFeatures,
		dateRangeQuery,
		facetCounts,
		facetOptions,
		formatDate,
		formatDateFull,
		type DataTableFeatures,
		type DateRange
	} from '$lib/components/table/features';
	import {
		createColumnHelper,
		createTable,
		type ColumnFiltersState,
		type PaginationState,
		type SortingState,
		type Updater
	} from '@tanstack/svelte-table';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import ResumeLinkModal from './ResumeLinkModal.svelte';

	let isDemo = $derived(page.data.user?.scope === 'demo');

	let interviews = $state<InterviewSummaryPublic[]>([]);
	let loading = $state(false);
	let hasLoaded = $state(false);
	let totalItems = $state(0);
	let facets = $state<InterviewFacets>({});
	let error = $state<string | null>(null);
	let activeDropdown = $state<string | null>(null);
	let dropdownPosition = $state({ top: 0, right: 0 });

	const project_id = $derived(page.params.project_id as string);

	/* ---------------------------------------------------------------- table */

	// Everything about this table happens on the server, so every state slice
	// that shapes the query is owned here and every change refetches. The
	// controls still read and write TanStack's own state, which keeps
	// DataTable's search box, "Clear filters" and empty states working as they
	// do on the client-side tables.
	let sorting = $state<SortingState>([{ id: 'created_at', desc: true }]);
	let pagination = $state<PaginationState>({ pageIndex: 0, pageSize: 20 });
	let columnFilters = $state<ColumnFiltersState>([]);
	let globalFilter = $state('');

	// Not part of TanStack's filter state: it comes in as `?pid=` from the
	// participants table's "view interviews" link, is matched exactly rather
	// than searched, and has no column control of its own. Keeping it separate
	// also keeps DataTable's "Clear filters" from silently dropping it -- the
	// chip carries its own dismiss.
	let pidFilter = $state<string | null>(null);

	/** Drop the participant filter and take it out of the URL with it. */
	function clearPidFilter() {
		pidFilter = null;
		replaceState(
			resolve(`/dashboard/projects/${project_id}/${page.params.lang ?? 'en'}/interviews`),
			page.state
		);
		pagination = { ...pagination, pageIndex: 0 };
		scheduleLoad();
	}

	/** A column's selected facet values, as `FacetedFilter` stores them. */
	function selection<T extends string = string>(columnId: string) {
		return columnFilters.find((filter) => filter.id === columnId)?.value as T[] | undefined;
	}

	const helper = createColumnHelper<DataTableFeatures, InterviewSummaryPublic>();

	const columns = helper.columns([
		helper.display({ id: 'select', enableHiding: false }),
		helper.accessor('id', {
			header: 'ID',
			// The API sorts by a fixed set of columns and id is not one of them,
			// so the header must not offer it.
			enableSorting: false,
			meta: { class: 'font-mono text-xs whitespace-nowrap text-gray-500' }
		}),
		helper.accessor('pid', {
			header: 'PID',
			meta: { class: 'font-mono text-xs whitespace-nowrap text-gray-600' }
		}),
		helper.accessor('created_at', {
			header: 'Created',
			meta: { class: 'whitespace-nowrap tabular-nums text-gray-600' }
		}),
		helper.accessor('last_updated', {
			header: 'Updated',
			meta: { class: 'whitespace-nowrap tabular-nums text-gray-600' }
		}),
		helper.accessor('n_messages', {
			header: 'Messages',
			meta: { align: 'right', class: 'tabular-nums text-gray-600' }
		}),
		helper.accessor('language', { header: 'Language', meta: { class: 'text-gray-600' } }),
		helper.accessor('status', { header: 'Status' }),
		helper.display({
			id: 'actions',
			header: 'Actions',
			enableHiding: false,
			meta: { align: 'right', class: 'whitespace-nowrap' }
		})
	]);

	const table = createTable({
		features: dataTableFeatures,
		columns,
		get data() {
			return interviews;
		},
		getRowId: (i) => i.id,
		// The server has already filtered, sorted and sliced; trust the incoming
		// rows and render them as they arrive.
		manualSorting: true,
		manualPagination: true,
		manualFiltering: true,
		// The API always needs a column and order, so sorting must never be
		// cleared to an empty state: clicking cycles asc/desc only.
		enableSortingRemoval: false,
		get rowCount() {
			return totalItems;
		},
		state: {
			get sorting() {
				return sorting;
			},
			get pagination() {
				return pagination;
			},
			get columnFilters() {
				return columnFilters;
			},
			get globalFilter() {
				return globalFilter;
			}
		},
		onSortingChange: (updater: Updater<SortingState>) => {
			sorting = typeof updater === 'function' ? updater(sorting) : updater;
			// A new sort order invalidates the current page.
			pagination = { ...pagination, pageIndex: 0 };
			scheduleLoad();
		},
		onPaginationChange: (updater: Updater<PaginationState>) => {
			pagination = typeof updater === 'function' ? updater(pagination) : updater;
			scheduleLoad();
		},
		// Filtering has to reset the page by hand: TanStack only does that
		// automatically for tables it paginates itself.
		onColumnFiltersChange: (updater: Updater<ColumnFiltersState>) => {
			columnFilters = typeof updater === 'function' ? updater(columnFilters) : updater;
			pagination = { ...pagination, pageIndex: 0 };
			scheduleLoad();
		},
		onGlobalFilterChange: (updater: Updater<string>) => {
			globalFilter = typeof updater === 'function' ? updater(globalFilter) : updater;
			pagination = { ...pagination, pageIndex: 0 };
			scheduleLoad();
		}
	});

	// A resume link is a bearer credential for one transcript, so it is issued
	// per interview from this dialog rather than mailed out with distribution.
	let resumeLinkFor = $state<InterviewSummaryPublic | null>(null);

	function openResumeLink(id: string) {
		resumeLinkFor = interviews.find((interview) => interview.id === id) ?? null;
	}

	/** Reads the way the Status cell does. */
	const STATUS_LABELS: Record<string, string> = {
		completed: 'Complete',
		active: 'Active',
		inactive: 'Inactive'
	};

	/**
	 * One fetch per burst of state changes. `Clear filters` sets the global
	 * filter and resets the column filters back to back, and each of those
	 * fires its own handler, so without this the button costs two round trips.
	 */
	let queued = false;

	function scheduleLoad() {
		if (queued) return;
		queued = true;
		queueMicrotask(() => {
			queued = false;
			loadInterviews();
		});
	}

	const columnLabels: Record<string, string> = {
		id: 'ID',
		pid: 'PID',
		created_at: 'Created',
		last_updated: 'Updated',
		n_messages: 'Messages',
		language: 'Language',
		status: 'Status'
	};

	const selectedIds = $derived(table.getSelectedRowIds());

	/** The row whose actions menu is open, for the menu's own conditionals. */
	const activeInterview = $derived(
		activeDropdown ? (interviews.find((i) => i.id === activeDropdown) ?? null) : null
	);

	/* ----------------------------------------------------------------- data */

	// Sorting and paging both refetch, so two requests can easily be in flight at
	// once. Only the newest may write: an earlier response landing later would
	// paint rows that no longer match the current sort or page.
	let requestId = 0;

	async function loadInterviews() {
		const id = ++requestId;
		loading = true;
		error = null;
		try {
			const response = await Api.getInterviews({
				path: { project_id },
				query: {
					offset: pagination.pageIndex * pagination.pageSize,
					limit: pagination.pageSize,
					column: sorting[0]?.id ?? 'created_at',
					order: sorting[0]?.desc ? 'desc' : 'asc',
					search: globalFilter || undefined,
					pid: pidFilter || undefined,
					statuses: selection<InterviewStatus>('status'),
					languages: selection('language'),
					...dateRangeQuery(
						columnFilters.find((filter) => filter.id === 'created_at')?.value as
							DateRange | undefined
					)
				}
			});
			if (id !== requestId) return;

			if (response.error) {
				console.error('Error fetching interviews:', response.error);
				error = 'Failed to load interviews';
				interviews = [];
				totalItems = 0;
				facets = {};
			} else if (response.data) {
				interviews = response.data.items;
				totalItems = response.data.total;
				facets = response.data.facets ?? {};
			} else {
				interviews = [];
				totalItems = 0;
				facets = {};
			}
		} finally {
			// Whatever happened, the refresh button must not stay disabled.
			if (id === requestId) {
				loading = false;
				hasLoaded = true;
			}
		}
	}

	async function handleDeleteSelected() {
		if (
			!confirm(
				`Are you sure you want to delete the selected ${selectedIds.length} interview(s)? This action cannot be undone.`
			)
		)
			return;

		const { error: deleteError } = await Api.deleteInterviews({
			path: { project_id },
			body: { interview_ids: selectedIds }
		});
		if (deleteError) {
			console.error('Error deleting interviews:', deleteError);
			toast.error('Failed to delete interviews');
			return;
		}
		table.resetRowSelection(true);
		// Deleting the last rows of the final page would otherwise leave the table
		// pointing past the end of the shortened dataset.
		table.setPageIndex(0);
	}

	async function handleDownloadSelected() {
		downloadFile(selectedIds, 'xlsx');
	}

	async function downloadFile(ids: string[], format: 'csv' | 'xlsx') {
		const response = await Api.exportMessages({
			path: { project_id },
			body: { interview_ids: ids, format },
			parseAs: 'blob'
		});

		if (response.error) {
			console.error('Error downloading file:', response.error);
			toast.error('Failed to download file');
			return;
		}

		if (response.data) {
			const url = window.URL.createObjectURL(response.data as Blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `interview_${project_id}.${format}`;
			document.body.appendChild(a);
			a.click();
			window.URL.revokeObjectURL(url);
			document.body.removeChild(a);
		}
	}

	function handleSingleAction(action: 'view' | 'download' | 'delete' | 'resume-link', id: string) {
		activeDropdown = null;
		if (action === 'resume-link') {
			openResumeLink(id);
		} else if (action === 'view') {
			const lang = page.params.lang || 'en';
			window.open(`/dashboard/projects/${project_id}/${lang}/interviews/${id}`, '_self')?.focus();
		} else if (action === 'download') {
			downloadFile([id], 'csv');
		} else if (action === 'delete') {
			if (confirm('Are you sure you want to delete this interview?')) {
				Api.deleteInterviews({
					path: { project_id },
					body: { interview_ids: [id] }
				}).then((res) => {
					if (res.error) {
						console.error('Failed to delete interview:', res.error);
						toast.error('Failed to delete interview');
						return;
					}
					loadInterviews();
				});
			}
		}
	}

	function toggleDropdown(event: MouseEvent, id: string) {
		const target = event.currentTarget as HTMLElement;
		const rect = target.getBoundingClientRect();
		if (activeDropdown === id) {
			activeDropdown = null;
		} else {
			activeDropdown = id;
			dropdownPosition = { top: rect.bottom, right: window.innerWidth - rect.right };
		}
	}

	function handleWindowClick(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('.dropdown-container') && !target.closest('.dropdown-menu')) {
			activeDropdown = null;
		}
	}

	/**
	 * The menu is placed from a one-off measurement of its trigger, so it cannot
	 * follow it. Capture phase, because a scroll inside the table's own row area
	 * does not bubble.
	 */
	function handleScroll() {
		activeDropdown = null;
	}

	onMount(() => {
		pidFilter = page.url.searchParams.get('pid');
		loadInterviews();
		window.addEventListener('click', handleWindowClick);
		window.addEventListener('scroll', handleScroll, true);
		return () => {
			window.removeEventListener('click', handleWindowClick);
			window.removeEventListener('scroll', handleScroll, true);
		};
	});
</script>

{#if isDemo}
	<DemoRestrictionOverlay
		title="Interviews unavailable"
		description="You cannot view interviews with your current demo access."
	/>
{/if}

<div class="mb-4 flex flex-wrap items-end justify-between gap-3">
	<h1 class="page-title mb-0">Interviews</h1>
	<button
		class="flex h-9 w-9 items-center justify-center rounded-md text-gray-500 hover:bg-secondary/40 hover:text-dark focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-30"
		onclick={loadInterviews}
		title="Refresh"
		aria-label="Refresh"
		disabled={loading}
	>
		<i class="fa-solid fa-arrows-rotate {loading ? 'animate-spin' : ''}"></i>
	</button>
</div>

{#if error}
	<div
		class="relative mb-4 rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700"
		role="alert"
	>
		<span class="block sm:inline">{error}</span>
	</div>
{/if}

<DataTable
	{table}
	{columnLabels}
	{loading}
	{hasLoaded}
	search
	searchPlaceholder="Search by interview ID or PID..."
	rowCount={totalItems}
	rowLabel="interview"
	emptyTitle={pidFilter ? 'No interviews for this participant' : 'No interviews yet'}
	emptyDescription={pidFilter
		? `Nothing has been recorded for ${pidFilter} yet.`
		: 'Interviews appear here once participants start responding.'}
>
	{#snippet filters()}
		{#if pidFilter}
			<span
				class="flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 py-1 pr-1 pl-2.5 text-sm"
			>
				<span class="text-gray-600">Participant</span>
				<span class="font-mono font-semibold text-dark">{pidFilter}</span>
				<button
					class="rounded p-1 text-gray-400 hover:bg-secondary/40 hover:text-dark focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
					onclick={clearPidFilter}
					title="Show all participants"
					aria-label="Clear participant filter"
				>
					<i class="fa-solid fa-xmark text-xs"></i>
				</button>
			</span>
		{/if}
		<FacetedFilter
			title="Status"
			column={table.getColumn('status')!}
			options={facetOptions(facets.status, STATUS_LABELS)}
			counts={facetCounts(facets.status)}
		/>
		<FacetedFilter
			title="Language"
			column={table.getColumn('language')!}
			options={facetOptions(facets.language)}
			counts={facetCounts(facets.language)}
		/>
		<DateRangeFilter title="Created" column={table.getColumn('created_at')!} />
	{/snippet}

	{#snippet selectionActions()}
		<button
			class="ml-1 flex items-center gap-1.5 rounded px-2 py-0.5 text-gray-700 hover:bg-secondary/40"
			onclick={handleDownloadSelected}
		>
			<i class="fa-solid fa-download text-xs"></i>
			Download
		</button>
		<button
			class="flex items-center gap-1.5 rounded px-2 py-0.5 text-red-600 hover:bg-red-50"
			onclick={handleDeleteSelected}
		>
			<i class="fa-solid fa-trash-can text-xs"></i>
			Delete
		</button>
	{/snippet}

	{#snippet cell(columnId, row)}
		{@const interview = row.original}
		{#if columnId === 'id'}
			{interview.id}
		{:else if columnId === 'pid'}
			{#if interview.pid}{interview.pid}{:else}<span class="text-gray-300">&ndash;</span>{/if}
		{:else if columnId === 'created_at'}
			<span title={formatDateFull(interview.created_at)}>{formatDate(interview.created_at)}</span>
		{:else if columnId === 'last_updated'}
			<span title={formatDateFull(interview.last_updated)}
				>{formatDate(interview.last_updated)}</span
			>
		{:else if columnId === 'n_messages'}
			{interview.n_messages}
		{:else if columnId === 'language'}
			{interview.language}
		{:else if columnId === 'status'}
			{#if interview.status === 'completed'}
				<span class="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
					Complete
				</span>
			{:else if interview.status === 'active'}
				<span class="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
					Active
				</span>
			{:else}
				<span class="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">
					Inactive
				</span>
			{/if}
		{:else if columnId === 'actions'}
			<div class="dropdown-container relative inline-block">
				<button
					class="rounded p-1.5 text-gray-400 hover:bg-secondary/40 hover:text-dark"
					onclick={(e) => {
						e.stopPropagation();
						toggleDropdown(e, interview.id);
					}}
					aria-label="Actions"
				>
					<i class="fa-solid fa-ellipsis-vertical text-xs"></i>
				</button>
			</div>
		{/if}
	{/snippet}
</DataTable>

{#if activeDropdown}
	<div
		class="dropdown-menu fixed z-2000 mt-2 w-48 rounded-md border border-gray-200 bg-white py-1 text-left shadow-lg"
		style="top: {dropdownPosition.top}px; right: {dropdownPosition.right}px;"
	>
		<button
			class="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-secondary/40"
			onclick={() => handleSingleAction('view', activeDropdown!)}
		>
			<i class="fa-solid fa-eye mr-2 text-gray-400"></i> View
		</button>
		<button
			class="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-secondary/40"
			onclick={() => handleSingleAction('download', activeDropdown!)}
		>
			<i class="fa-solid fa-download mr-2 text-gray-400"></i> Download
		</button>
		{#if activeInterview && activeInterview.status !== 'completed'}
			<button
				class="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-secondary/40"
				onclick={() => handleSingleAction('resume-link', activeDropdown!)}
			>
				<i class="fa-solid fa-link mr-2 text-gray-400"></i> Resume link
			</button>
		{/if}
		<button
			class="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
			onclick={() => handleSingleAction('delete', activeDropdown!)}
		>
			<i class="fa-solid fa-trash-can mr-2"></i> Delete
		</button>
	</div>
{/if}

<ResumeLinkModal
	open={resumeLinkFor !== null}
	projectId={project_id}
	interviewId={resumeLinkFor?.id ?? null}
	pid={resumeLinkFor?.pid}
	onClose={() => (resumeLinkFor = null)}
/>
