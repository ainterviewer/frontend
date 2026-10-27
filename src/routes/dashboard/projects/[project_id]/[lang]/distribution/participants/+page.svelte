<script lang="ts">
	import {
		type ColumnFiltersState,
		createColumnHelper,
		createTable,
		type PaginationState,
		type RowSelectionState,
		type SortingState,
		type Updater
	} from '@tanstack/svelte-table';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';

	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Participants } from '$lib/api';
	import type {
		InterviewStatus,
		ParticipantFacets,
		ParticipantFilterParams,
		ParticipantPublic,
		ParticipantSelection
	} from '$lib/api/types.gen';
	import DataTable from '$lib/components/table/DataTable.svelte';
	import FacetedFilter from '$lib/components/table/FacetedFilter.svelte';
	import {
		type DataTableFeatures,
		dataTableFeatures,
		facetCounts,
		facetOptions
	} from '$lib/components/table/features';
	import { formatDate, formatDateFull } from '$lib/utils/datetime';
	import { toastApiError } from '$lib/utils/toast';

	const project_id = $derived(page.params.project_id as string);
	const lang = $derived(page.params.lang ?? 'en');
	const isDemo = $derived(page.data.user?.scope === 'demo');

	/** The interviews list, narrowed to one participant. Matched on pid rather
	 * than on the participant id because pid is what the interview list shows
	 * and what a reader can check the result against. */
	const interviewsHref = (pid: string) =>
		resolve(`/dashboard/projects/${project_id}/${lang}/interviews?pid=${encodeURIComponent(pid)}`);

	let participants = $state<ParticipantPublic[]>([]);
	let loading = $state(false);
	let hasLoaded = $state(false);
	let totalItems = $state(0);
	let facets = $state<ParticipantFacets>({});
	let error = $state<string | null>(null);

	type EditState = { name: string; email: string; pid: string; participating: boolean };
	let editingId = $state<string | null>(null);
	let editDraft = $state<EditState>({ name: '', email: '', pid: '', participating: true });

	type DraftRow = { name: string; email: string; pid: string; participating: boolean };
	const blankRow = (): DraftRow => ({ name: '', email: '', pid: '', participating: true });

	let showAddPanel = $state(false);
	let addRows = $state<DraftRow[]>([blankRow()]);
	let saving = $state(false);

	let fileInput: HTMLInputElement;

	/** Each click adds a full turn, so the icon spins once per refresh. */
	let refreshTurns = $state(0);

	/* ---------------------------------------------------------------- table */

	// Everything about this table happens on the server, so every state slice
	// that shapes the query is owned here and every change refetches. The
	// controls still read and write TanStack's own state, which keeps
	// DataTable's search box, "Clear filters" and empty states working.
	let sorting = $state<SortingState>([{ id: 'created_at', desc: true }]);
	let pagination = $state<PaginationState>({ pageIndex: 0, pageSize: 25 });
	let columnFilters = $state<ColumnFiltersState>([]);
	let globalFilter = $state('');
	let rowSelection = $state<RowSelectionState>({});

	// "Select all 1,234": the selection is every participant matching the
	// filters, not the ids in `rowSelection`, most of which were never loaded.
	// Any change to the selection or the filters drops back to plain ids.
	let allMatching = $state(false);

	/** A column's selected facet values, as `FacetedFilter` stores them. */
	function selection<T extends string = string>(columnId: string) {
		return columnFilters.find((filter) => filter.id === columnId)?.value as T[] | undefined;
	}

	const helper = createColumnHelper<DataTableFeatures, ParticipantPublic>();

	const columns = helper.columns([
		helper.display({ id: 'select', enableHiding: false }),
		helper.accessor('name', { header: 'Name', meta: { class: 'font-medium text-dark' } }),
		helper.accessor('email', { header: 'Email', meta: { class: 'text-gray-700' } }),
		helper.accessor('pid', { header: 'PID', meta: { class: 'font-mono text-xs text-gray-500' } }),
		helper.accessor('participating', { header: 'Participating' }),
		helper.accessor('created_at', {
			header: 'Created',
			meta: { class: 'whitespace-nowrap tabular-nums text-gray-600' }
		}),
		helper.accessor('latest_interview_at', {
			header: 'Latest interview activity',
			meta: { class: 'whitespace-nowrap tabular-nums text-gray-600' }
		}),
		helper.accessor('latest_interview_status', {
			header: 'Latest interview status',
			meta: { class: 'text-gray-600' }
		}),
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
			return participants;
		},
		getRowId: (p) => p.id,
		// The server has already filtered, sorted and sliced.
		manualSorting: true,
		manualPagination: true,
		manualFiltering: true,
		// The API always needs a column and order: clicking cycles asc/desc only.
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
			},
			get rowSelection() {
				return rowSelection;
			}
		},
		onRowSelectionChange: (updater: Updater<RowSelectionState>) => {
			// Leaving "all" mode by unticking a row starts from what was on screen:
			// every row of this page ticked, not just the ones visited before.
			const base: RowSelectionState = allMatching
				? {
						...rowSelection,
						...Object.fromEntries(participants.map((p) => [p.id, true as const]))
					}
				: rowSelection;
			rowSelection = typeof updater === 'function' ? updater(base) : updater;
			allMatching = false;
		},
		onSortingChange: (updater: Updater<SortingState>) => {
			sorting = typeof updater === 'function' ? updater(sorting) : updater;
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
			allMatching = false;
			pagination = { ...pagination, pageIndex: 0 };
			scheduleLoad();
		},
		onGlobalFilterChange: (updater: Updater<string>) => {
			globalFilter = typeof updater === 'function' ? updater(globalFilter) : updater;
			allMatching = false;
			pagination = { ...pagination, pageIndex: 0 };
			scheduleLoad();
		}
	});

	const PARTICIPATING_LABELS: Record<string, string> = { true: 'Yes', false: 'No' };

	/**
	 * One fetch per burst of state changes: "Clear filters" resets the global
	 * and the column filters back to back, each through its own handler.
	 */
	let queued = false;

	function scheduleLoad() {
		if (queued) return;
		queued = true;
		queueMicrotask(() => {
			queued = false;
			load();
		});
	}

	const columnLabels: Record<string, string> = {
		name: 'Name',
		email: 'Email',
		pid: 'PID',
		participating: 'Participating',
		created_at: 'Created',
		latest_interview_at: 'Latest interview activity',
		latest_interview_status: 'Latest interview status'
	};

	const selectedIds = $derived(table.getSelectedRowIds());
	const selectedCount = $derived(allMatching ? totalItems : selectedIds.length);

	/** The list's filters, as both the list and the bulk actions send them. */
	function currentFilters() {
		// Both values selected is the same query as neither.
		const participating = selection('participating');
		return {
			search: globalFilter || undefined,
			participating: participating?.length === 1 ? participating[0] === 'true' : undefined,
			statuses: selection<InterviewStatus>('latest_interview_status')
		} satisfies ParticipantFilterParams;
	}

	/** What a bulk action targets: the ticked ids, or everything matching. */
	function selectionBody(): ParticipantSelection {
		return allMatching ? { filters: currentFilters() } : { participant_ids: selectedIds };
	}

	/* ----------------------------------------------------------------- data */

	// Sorting and paging both refetch, so two requests can be in flight at once.
	// Only the newest may write.
	let requestId = 0;

	async function load() {
		const id = ++requestId;
		loading = true;
		error = null;
		try {
			const res = await Participants.getParticipants({
				path: { project_id },
				query: {
					offset: pagination.pageIndex * pagination.pageSize,
					limit: pagination.pageSize,
					column: sorting[0]?.id ?? 'created_at',
					order: sorting[0]?.desc ? 'desc' : 'asc',
					...currentFilters()
				}
			});
			if (id !== requestId) return;
			if (res.error || !res.data) {
				error = 'Failed to load participants';
				participants = [];
				totalItems = 0;
				facets = {};
			} else {
				participants = res.data.items;
				totalItems = res.data.total;
				facets = res.data.facets ?? {};
				// Deleting the last rows of the final page leaves it past the end.
				const lastPage = Math.max(0, Math.ceil(totalItems / pagination.pageSize) - 1);
				if (pagination.pageIndex > lastPage) {
					pagination = { ...pagination, pageIndex: lastPage };
					scheduleLoad();
				}
			}
		} finally {
			if (id === requestId) {
				loading = false;
				hasLoaded = true;
			}
		}
	}

	function trimOrNull(v: string): string | null {
		const t = v.trim();
		return t ? t : null;
	}

	function addRow() {
		addRows = [...addRows, blankRow()];
	}

	function removeRow(idx: number) {
		addRows = addRows.filter((_, i) => i !== idx);
		if (addRows.length === 0) addRows = [blankRow()];
	}

	function openAdd() {
		addRows = [blankRow()];
		showAddPanel = true;
	}

	function cancelAdd() {
		showAddPanel = false;
		addRows = [blankRow()];
	}

	/** The ticked participants, or with none ticked every one the list matches. */
	async function exportParticipants() {
		const { data, error: exportError } = await Participants.exportParticipants({
			path: { project_id },
			body: selectedCount > 0 ? selectionBody() : { filters: currentFilters() },
			parseAs: 'blob'
		});
		if (exportError) {
			toastApiError(exportError, 'Failed to export participants');
			return;
		}
		if (!data) return;
		const url = window.URL.createObjectURL(data);
		const a = document.createElement('a');
		a.href = url;
		a.download = `participants_${project_id}.csv`;
		document.body.appendChild(a);
		a.click();
		window.URL.revokeObjectURL(url);
		document.body.removeChild(a);
	}

	async function saveAdd() {
		const cleaned = addRows
			.map((r) => ({
				name: trimOrNull(r.name),
				email: trimOrNull(r.email),
				pid: trimOrNull(r.pid),
				participating: r.participating
			}))
			.filter((r) => r.name || r.email || r.pid);

		if (cleaned.length === 0) {
			toast.error('Please fill in at least one row');
			return;
		}

		saving = true;
		if (cleaned.length === 1) {
			const res = await Participants.addParticipant({ path: { project_id }, body: cleaned[0] });
			saving = false;
			if (res.error) {
				toastApiError(res.error, 'Failed to add participant');
				return;
			}
			toast.success('Participant added');
		} else {
			const res = await Participants.addParticipants({ path: { project_id }, body: cleaned });
			saving = false;
			if (res.error) {
				toastApiError(res.error, 'Failed to add participants');
				return;
			}
			toast.success(`Added ${cleaned.length} participants`);
		}
		showAddPanel = false;
		addRows = [blankRow()];
		await load();
	}

	function startEdit(p: ParticipantPublic) {
		editingId = p.id;
		editDraft = {
			name: p.name ?? '',
			email: p.email ?? '',
			pid: p.pid ?? '',
			participating: p.participating ?? true
		};
	}

	function cancelEdit() {
		editingId = null;
	}

	async function saveEdit(id: string) {
		const res = await Participants.updateParticipant({
			path: { project_id, participant_id: id },
			body: {
				name: trimOrNull(editDraft.name),
				email: trimOrNull(editDraft.email),
				pid: trimOrNull(editDraft.pid) ?? undefined,
				participating: editDraft.participating
			}
		});
		if (res.error) {
			toastApiError(res.error, 'Failed to update participant');
			return;
		}
		editingId = null;
		await load();
	}

	async function deleteOne(id: string) {
		if (!confirm('Delete this participant?')) return;
		const res = await Participants.deleteParticipant({
			path: { project_id, participant_id: id }
		});
		if (res.error) {
			toastApiError(res.error, 'Failed to delete participant');
			return;
		}
		// Row selection is independent state and keeps ids after the row is gone.
		table.setRowSelection((old) => {
			const next = { ...old };
			delete next[id];
			return next;
		});
		await load();
	}

	async function deleteSelected() {
		if (selectedCount === 0) return;
		if (
			!confirm(
				allMatching
					? `Delete all ${selectedCount} participant(s) matching the current filters? This cannot be undone.`
					: `Delete ${selectedCount} participant(s)? This cannot be undone.`
			)
		)
			return;
		const res = await Participants.deleteParticipants({
			path: { project_id },
			body: selectionBody()
		});
		if (res.error) {
			toastApiError(res.error, 'Failed to delete participants');
			return;
		}
		table.resetRowSelection(true);
		await load();
	}

	async function handleUpload(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		const res = await Participants.uploadParticipants({ path: { project_id }, body: { file } });
		input.value = '';
		if (res.error) {
			toastApiError(res.error, 'Failed to upload file');
			return;
		}
		const skipped = res.data?.skipped_rows ?? 0;
		const added = res.data?.participants.length ?? 0;
		toast.success(
			skipped > 0
				? `${added} participant(s) added, ${skipped} blank row(s) skipped`
				: `${added} participant(s) added`
		);
		await load();
	}

	onMount(load);
</script>

<div class="mb-4 flex flex-wrap items-end justify-between gap-3">
	<h1 class="page-title mb-0">Participants</h1>
	<div class="flex items-center gap-1">
		<button
			class="flex h-9 w-9 items-center justify-center rounded-md text-gray-500 hover:bg-secondary/40 hover:text-dark focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-30"
			onclick={() => {
				refreshTurns += 1;
				load();
			}}
			title="Refresh"
			aria-label="Refresh"
			disabled={isDemo}
		>
			<i
				class="fa-solid fa-arrows-rotate transition-transform duration-500 ease-out"
				style="transform: rotate({refreshTurns * 360}deg)"
			></i>
		</button>
		<span class="mx-1 h-6 w-px bg-gray-200"></span>
		<button
			class="flex h-9 w-9 items-center justify-center rounded-md text-gray-500 hover:bg-secondary/40 hover:text-dark focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-30"
			onclick={openAdd}
			disabled={isDemo}
			title="Add participants"
			aria-label="Add participants"
		>
			<i class="fa-solid fa-plus"></i>
		</button>
		<button
			class="flex h-9 w-9 items-center justify-center rounded-md text-gray-500 hover:bg-secondary/40 hover:text-dark focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-30"
			onclick={() => fileInput?.click()}
			disabled={isDemo}
			title="Upload CSV or Excel file"
			aria-label="Upload CSV or Excel file"
		>
			<i class="fa-solid fa-file-arrow-up"></i>
		</button>
		<input
			bind:this={fileInput}
			type="file"
			accept=".csv,.xlsx,.xls"
			class="hidden"
			onchange={handleUpload}
		/>
		<button
			class="flex h-9 w-9 items-center justify-center rounded-md text-gray-500 hover:bg-secondary/40 hover:text-dark focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-30"
			onclick={exportParticipants}
			disabled={isDemo || totalItems === 0}
			title={selectedCount > 0
				? `Export ${selectedCount} selected as CSV`
				: `Export all ${totalItems} as CSV`}
			aria-label="Export CSV"
		>
			<i class="fa-solid fa-file-arrow-down"></i>
		</button>
	</div>
</div>

{#if error}
	<div class="mb-4 rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700" role="alert">
		{error}
	</div>
{/if}

{#if showAddPanel}
	<div class="mb-4 shrink-0 rounded-lg border border-gray-200 bg-white p-4 shadow">
		<div class="mb-3 flex items-center justify-between">
			<h2 class="text-sm font-semibold text-gray-700">
				Add participants ({addRows.length} row{addRows.length === 1 ? '' : 's'})
			</h2>
			<button class="text-gray-500 hover:text-gray-700" onclick={cancelAdd} title="Close">
				<i class="fa-solid fa-xmark"></i>
			</button>
		</div>
		<div class="overflow-x-auto">
			<table class="min-w-full text-sm">
				<thead>
					<tr class="text-left text-xs font-semibold tracking-wider text-gray-600 uppercase">
						<th class="px-2 py-2">Name</th>
						<th class="px-2 py-2">Email</th>
						<th class="px-2 py-2">PID</th>
						<th class="px-2 py-2">Participating</th>
						<th class="w-10 px-2 py-2"></th>
					</tr>
				</thead>
				<tbody>
					{#each addRows as row, i (i)}
						<tr class="border-t border-gray-100">
							<td class="px-2 py-1.5">
								<input
									type="text"
									bind:value={row.name}
									class="w-full rounded border border-gray-300 px-2 py-1 focus:border-primary focus:outline-none"
								/>
							</td>
							<td class="px-2 py-1.5">
								<input
									type="email"
									bind:value={row.email}
									class="w-full rounded border border-gray-300 px-2 py-1 focus:border-primary focus:outline-none"
								/>
							</td>
							<td class="px-2 py-1.5">
								<input
									type="text"
									bind:value={row.pid}
									class="w-full rounded border border-gray-300 px-2 py-1 focus:border-primary focus:outline-none"
								/>
							</td>
							<td class="px-2 py-1.5">
								<input
									type="checkbox"
									bind:checked={row.participating}
									class="form-checkbox h-4 w-4 cursor-pointer text-primary"
								/>
							</td>
							<td class="px-2 py-1.5 text-right">
								<button
									class="text-gray-400 hover:text-red-600"
									onclick={() => removeRow(i)}
									title="Remove row"
									aria-label="Remove row"
								>
									<i class="fa-solid fa-xmark"></i>
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<div class="mt-3 flex items-center justify-between">
			<button
				class="rounded border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50"
				onclick={addRow}
			>
				<i class="fa-solid fa-plus mr-1"></i> Add row
			</button>
			<div class="flex gap-2">
				<button
					class="rounded border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50"
					onclick={cancelAdd}
				>
					Cancel
				</button>
				<button
					class="rounded bg-primary px-3 py-1 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
					onclick={saveAdd}
					disabled={saving}
				>
					{saving ? 'Saving...' : 'Save'}
				</button>
			</div>
		</div>
	</div>
{/if}

<DataTable
	{table}
	{columnLabels}
	{loading}
	{hasLoaded}
	search
	searchPlaceholder="Search name, email or PID..."
	rowCount={totalItems}
	rowLabel="participant"
	allMatchingSelected={allMatching}
	onSelectAllMatching={() => (allMatching = true)}
	emptyTitle="No participants yet"
	emptyDescription="Add participants directly, or upload a CSV or Excel file."
>
	{#snippet filters()}
		<FacetedFilter
			title="Participating"
			column={table.getColumn('participating')!}
			options={facetOptions(facets.participating, PARTICIPATING_LABELS)}
			counts={facetCounts(facets.participating)}
		/>
		<FacetedFilter
			title="Status"
			column={table.getColumn('latest_interview_status')!}
			options={facetOptions(facets.status)}
			counts={facetCounts(facets.status)}
		/>
	{/snippet}

	{#snippet selectionActions()}
		<button
			class="ml-1 flex items-center gap-1.5 rounded px-2 py-0.5 text-red-600 hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-400/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
			onclick={deleteSelected}
			disabled={isDemo}
		>
			<i class="fa-solid fa-trash-can text-xs"></i>
			Delete
		</button>
	{/snippet}

	{#snippet cell(columnId, row)}
		{@const p = row.original}
		{@const editing = editingId === p.id}
		{#if columnId === 'name'}
			{#if editing}
				<input
					type="text"
					bind:value={editDraft.name}
					class="w-full rounded border border-gray-300 px-2 py-1 focus:border-primary focus:outline-none"
				/>
			{:else if p.name}{p.name}{:else}<span class="text-gray-300">&ndash;</span>{/if}
		{:else if columnId === 'email'}
			{#if editing}
				<input
					type="email"
					bind:value={editDraft.email}
					class="w-full rounded border border-gray-300 px-2 py-1 focus:border-primary focus:outline-none"
				/>
			{:else if p.email}{p.email}{:else}<span class="text-gray-300">&ndash;</span>{/if}
		{:else if columnId === 'pid'}
			{#if editing}
				<input
					type="text"
					bind:value={editDraft.pid}
					class="w-full rounded border border-gray-300 px-2 py-1 focus:border-primary focus:outline-none"
				/>
			{:else if p.pid}{p.pid}{:else}<span class="text-gray-300">&ndash;</span>{/if}
		{:else if columnId === 'participating'}
			{#if editing}
				<input
					type="checkbox"
					bind:checked={editDraft.participating}
					class="form-checkbox h-4 w-4 cursor-pointer rounded border-gray-400 text-primary"
				/>
			{:else if p.participating}
				<span class="rounded-full bg-primary/20 px-2 py-0.5 text-xs font-semibold text-primary">
					Yes
				</span>
			{:else}
				<span class="rounded-full bg-red-800/20 px-2 py-0.5 text-xs font-semibold text-red-800">
					No
				</span>
			{/if}
		{:else if columnId === 'created_at'}
			<span title={formatDateFull(p.created_at)}>{formatDate(p.created_at)}</span>
		{:else if columnId === 'latest_interview_at'}
			{#if p.latest_interview_at}
				<span title={formatDateFull(p.latest_interview_at)}>
					{formatDate(p.latest_interview_at)}
				</span>
			{:else}<span class="text-gray-300">&ndash;</span>{/if}
		{:else if columnId === 'latest_interview_status'}
			{#if p.latest_interview_status}{p.latest_interview_status}{:else}<span class="text-gray-300"
					>&ndash;</span
				>{/if}
		{:else if columnId === 'actions'}
			{#if editing}
				<button
					class="mr-1 rounded p-1.5 text-primary hover:bg-primary/10"
					onclick={() => saveEdit(p.id)}
					title="Save changes"
					aria-label="Save changes"
				>
					<i class="fa-solid fa-check"></i>
				</button>
				<button
					class="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-dark"
					onclick={cancelEdit}
					title="Cancel"
					aria-label="Cancel"
				>
					<i class="fa-solid fa-xmark"></i>
				</button>
			{:else}
				<a
					class="mr-1 inline-block rounded p-1.5 text-gray-400 hover:bg-secondary/40 hover:text-dark"
					href={interviewsHref(p.pid)}
					title="View interviews"
					aria-label="View interviews"
				>
					<i class="fa-solid fa-comments text-xs"></i>
				</a>
				<button
					class="mr-1 rounded p-1.5 text-gray-400 hover:bg-secondary/40 hover:text-dark disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
					onclick={() => startEdit(p)}
					disabled={isDemo}
					title="Edit"
					aria-label="Edit"
				>
					<i class="fa-solid fa-pen text-xs"></i>
				</button>
				<button
					class="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
					onclick={() => deleteOne(p.id)}
					disabled={isDemo}
					title="Delete"
					aria-label="Delete"
				>
					<i class="fa-solid fa-trash-can text-xs"></i>
				</button>
			{/if}
		{/if}
	{/snippet}
</DataTable>
