<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { Admin, type Scope } from '$lib/api';
	import DataTable from '$lib/components/table/DataTable.svelte';
	import FacetedFilter from '$lib/components/table/FacetedFilter.svelte';
	import {
		dataTableFeatures,
		NO_PAGINATION,
		formatDate,
		formatDateFull,
		matchesSelection,
		sortableText,
		sortableTime,
		type DataTableFeatures
	} from '$lib/components/table/features';
	import { errorMessage } from '$lib/utils/errors';
	import { createColumnHelper, createTable } from '@tanstack/svelte-table';
	import { toast } from 'svelte-sonner';
	import type { PageData } from './$types';

	interface AccessRequest {
		id: string;
		name: string;
		email: string;
		organization: string | null;
		status: string;
		message: string | null;
		created_at: string;
		updated_at: string;
	}

	let { data }: { data: PageData } = $props();

	let requests = $derived(data.requests as AccessRequest[]);
	let isLoading = $state(false);
	let error = $state<string | null>(null);
	let scopeByRequest = $state<Record<string, Scope>>({});

	const DEFAULT_USER_SCOPE: Scope = 'demo';
	const scopeOptions: Scope[] = ['admin', 'user', 'demo'];
	const scopeColors: Record<string, string> = {
		admin: 'bg-purple-100 text-purple-800 focus:border-purple-800 focus:ring-purple-800',
		user: 'bg-blue-100 text-blue-800 focus:border-blue-800 focus:ring-blue-800',
		demo: 'bg-amber-100 text-amber-800 focus:border-amber-800 focus:ring-amber-800'
	};

	$effect(() => {
		error = data.error;
		scopeByRequest = Object.fromEntries(data.requests.map((r) => [r.id, DEFAULT_USER_SCOPE]));
	});

	/* ---------------------------------------------------------------- table */

	const helper = createColumnHelper<DataTableFeatures, AccessRequest>();

	const columns = helper.columns([
		helper.display({ id: 'select', enableHiding: false }),
		helper.accessor((r) => sortableText(r.name), {
			id: 'name',
			header: 'Name',
			sortFn: 'text',
			sortUndefined: 'last',
			meta: { class: 'font-medium whitespace-nowrap text-dark' }
		}),
		helper.accessor((r) => sortableText(r.email), {
			id: 'email',
			header: 'Email',
			sortFn: 'text',
			sortUndefined: 'last',
			meta: { class: 'whitespace-nowrap text-gray-700' }
		}),
		helper.accessor((r) => sortableText(r.organization), {
			id: 'organization',
			header: 'Organization',
			sortFn: 'text',
			sortUndefined: 'last',
			meta: { class: 'whitespace-nowrap text-gray-600' }
		}),
		helper.accessor('status', {
			header: 'Status',
			sortFn: 'text',
			filterFn: matchesSelection
		}),
		helper.display({ id: 'scope', header: 'Scope' }),
		helper.accessor((r) => sortableText(r.message), {
			id: 'message',
			header: 'Message',
			sortFn: 'text',
			sortUndefined: 'last',
			meta: { class: 'max-w-xs truncate text-gray-600' }
		}),
		helper.accessor((r) => sortableTime(r.created_at), {
			id: 'created_at',
			header: 'Created',
			sortFn: 'basic',
			sortUndefined: 'last',
			meta: { class: 'whitespace-nowrap tabular-nums text-gray-600' }
		}),
		helper.accessor((r) => sortableTime(r.updated_at), {
			id: 'updated_at',
			header: 'Updated',
			sortFn: 'basic',
			sortUndefined: 'last',
			meta: { class: 'whitespace-nowrap tabular-nums text-gray-600' }
		})
	]);

	const searchableColumns = ['name', 'email', 'organization', 'message'];

	const table = createTable({
		features: dataTableFeatures,
		columns,
		get data() {
			return requests;
		},
		getRowId: (r) => r.id,
		globalFilterFn: 'includesString',
		getColumnCanGlobalFilter: (column) => searchableColumns.includes(column.id),
		initialState: { pagination: NO_PAGINATION, sorting: [{ id: 'created_at', desc: true }] }
	});

	const columnLabels: Record<string, string> = {
		name: 'Name',
		email: 'Email',
		organization: 'Organization',
		status: 'Status',
		scope: 'Scope',
		message: 'Message',
		created_at: 'Created',
		updated_at: 'Updated'
	};

	const selectedIds = $derived(table.getSelectedRowIds());

	/* --------------------------------------------------------------- actions */

	async function loadRequests() {
		if (isLoading) return;
		isLoading = true;
		error = null;
		try {
			await invalidateAll();
			table.resetRowSelection(true);
		} catch (e) {
			error = errorMessage(e) || 'Failed to fetch requests';
		} finally {
			isLoading = false;
		}
	}

	async function handleAction(action: 'approve' | 'deny') {
		const ids = selectedIds;
		if (ids.length === 0) {
			toast.error(`Please select one or more requests to ${action}.`);
			return;
		}

		isLoading = true;
		try {
			const response = await Admin.processAccessRequests({
				body: {
					ids,
					scopes: ids.map((id) => scopeByRequest[id] ?? DEFAULT_USER_SCOPE),
					action
				}
			});
			if (response.error) {
				throw new Error(String(response.error));
			}
			// Reset loading state so loadRequests can proceed (avoid deadlock)
			isLoading = false;
			await loadRequests();
			toast.success(`Requests ${action === 'approve' ? 'approved' : 'denied'}`);
		} catch (e) {
			error = `Failed to ${action} requests: ${errorMessage(e)}`;
			toast.error(error);
			isLoading = false;
		}
	}

	async function handleDelete() {
		const ids = selectedIds;
		if (ids.length === 0) {
			toast.error('Please select one or more requests to delete.');
			return;
		}

		if (!confirm('Are you sure you want to delete these requests?')) {
			return;
		}

		isLoading = true;
		try {
			const response = await Admin.deleteAccessRequests({ body: { ids } });
			if (response.error) {
				throw new Error(String(response.error));
			}
			isLoading = false;
			await loadRequests();
			toast.success('Requests deleted');
		} catch (e) {
			error = `Failed to delete requests: ${errorMessage(e)}`;
			toast.error(error);
			isLoading = false;
		}
	}
</script>

<svelte:head>
	<title>AInterviewer - Access Requests</title>
</svelte:head>

<div class="mb-4 flex flex-wrap items-end justify-between gap-3">
	<h2 class="page-title mb-0">Access Requests</h2>
	<button
		class="flex h-9 w-9 items-center justify-center rounded-md text-gray-500 hover:bg-secondary/40 hover:text-dark focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-30"
		onclick={loadRequests}
		title="Refresh"
		aria-label="Refresh"
		disabled={isLoading}
	>
		<i class="fa-solid fa-arrows-rotate {isLoading ? 'animate-spin' : ''}"></i>
	</button>
</div>

{#if error}
	<div
		class="relative mb-4 rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700"
		role="alert"
	>
		<strong class="font-bold">Error:</strong>
		<span class="block sm:inline">{error}</span>
	</div>
{/if}

<DataTable
	{table}
	{columnLabels}
	loading={isLoading}
	hasLoaded={!isLoading || requests.length > 0}
	search
	rowLabel="request"
	searchPlaceholder="Search name, email or organization..."
	emptyTitle="No access requests"
	emptyDescription="Requests appear here when someone asks for access."
>
	{#snippet filters()}
		{#if table.getColumn('status')}
			<FacetedFilter title="Status" column={table.getColumn('status')!} />
		{/if}
	{/snippet}

	{#snippet selectionActions()}
		<button
			class="ml-1 flex items-center gap-1.5 rounded px-2 py-0.5 text-green-700 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-40"
			onclick={() => handleAction('approve')}
			disabled={isLoading}
		>
			<i class="fa-solid fa-circle-check text-xs"></i>
			Approve
		</button>
		<button
			class="flex items-center gap-1.5 rounded px-2 py-0.5 text-orange-700 hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-40"
			onclick={() => handleAction('deny')}
			disabled={isLoading}
		>
			<i class="fa-solid fa-ban text-xs"></i>
			Deny
		</button>
		<button
			class="flex items-center gap-1.5 rounded px-2 py-0.5 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
			onclick={handleDelete}
			disabled={isLoading}
		>
			<i class="fa-solid fa-trash-can text-xs"></i>
			Delete
		</button>
	{/snippet}

	{#snippet cell(columnId, row)}
		{@const request = row.original}
		{#if columnId === 'name'}
			{request.name}
		{:else if columnId === 'email'}
			{request.email}
		{:else if columnId === 'organization'}
			{#if request.organization}{request.organization}{:else}<span class="text-gray-300"
					>&ndash;</span
				>{/if}
		{:else if columnId === 'status'}
			<span
				class="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold capitalize
					{request.status === 'fulfilled'
					? 'bg-green-100 text-green-800'
					: request.status === 'denied' || request.status === 'error'
						? 'bg-red-100 text-red-800'
						: 'bg-orange-100 text-orange-800'}"
			>
				{request.status}
			</span>
		{:else if columnId === 'scope'}
			<select
				value={scopeByRequest[request.id] ?? DEFAULT_USER_SCOPE}
				onclick={(e) => e.stopPropagation()}
				onchange={(e) => {
					const value = e.currentTarget.value as Scope;
					scopeByRequest = { ...scopeByRequest, [request.id]: value };
				}}
				class="w-24 rounded-md border border-gray-300 px-2 py-1 text-xs font-medium focus:outline-none {scopeColors[
					scopeByRequest[request.id] ?? DEFAULT_USER_SCOPE
				]}"
			>
				{#each scopeOptions as scope (scope)}
					<option value={scope}>{scope}</option>
				{/each}
			</select>
		{:else if columnId === 'message'}
			<span title={request.message || ''}>
				{#if request.message}{request.message}{:else}<span class="text-gray-300">&ndash;</span>{/if}
			</span>
		{:else if columnId === 'created_at'}
			<span title={formatDateFull(request.created_at)}>{formatDate(request.created_at)}</span>
		{:else if columnId === 'updated_at'}
			<span title={formatDateFull(request.updated_at)}>{formatDate(request.updated_at)}</span>
		{/if}
	{/snippet}
</DataTable>
