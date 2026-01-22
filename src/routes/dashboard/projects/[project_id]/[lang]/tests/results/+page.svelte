<script lang="ts">
	import { page } from '$app/state';
	import { Projects as Api } from '$lib/api';
	import type { InterviewSummaryPublic, InterviewType } from '$lib/api';
	import { onMount } from 'svelte';
	import TablePaginationFooter from '../../interviews/TablePaginationFooter.svelte';
	import SortableHeader from '../../interviews/SortableHeader.svelte';

	// Extend InterviewSummaryPublic with interview_type field
	type InterviewWithType = InterviewSummaryPublic & {
		interview_type?: InterviewType;
	};

	// State
	let interviews = $state<InterviewWithType[]>([]);
	let loading = $state(false);
	let totalItems = $state(0);
	let currentPage = $state(1);
	let itemsPerPage = $state(10);
	let sortColumn = $state('created_at');
	let sortOrder = $state<'asc' | 'desc'>('desc');
	let selectedInterviews = $state(new Set<string>());
	let activeDropdown = $state<string | null>(null);
	let dropdownPosition = $state({ top: 0, right: 0 });
	let error = $state<string | null>(null);

	const project_id = $derived(page.params.project_id as string);
	const totalPages = $derived(Math.ceil(totalItems / itemsPerPage));
	const allSelected = $derived(
		interviews.length > 0 && interviews.every((i) => selectedInterviews.has(i.id))
	);
	const isIndeterminate = $derived(
		interviews.some((i) => selectedInterviews.has(i.id)) && !allSelected
	);

	const columns = [
		{ key: 'id', label: 'ID' },
		{ key: 'created_at', label: 'Created' },
		{ key: 'last_updated', label: 'Updated' },
		{ key: 'n_messages', label: 'Messages' },
		{ key: 'interview_type', label: 'Type' },
		{ key: 'status', label: 'Status' }
	];

	async function loadInterviews() {
		loading = true;
		error = null;
		try {
			const offset = (currentPage - 1) * itemsPerPage;
			const response = await Api.getInterviews({
				path: { project_id },
				query: {
					offset,
					limit: itemsPerPage,
					column: sortColumn,
					order: sortOrder,
					interview_types: ['manual_test', 'synthetic_test']
				}
			});

			const data = response.data as any;
			if (data) {
				interviews = data.items || [];
				totalItems = data.total || 0;
			} else {
				interviews = [];
				totalItems = 0;
			}
		} catch (e) {
			console.error('Error fetching test results:', e);
			error = 'Failed to load test results';
			interviews = [];
			totalItems = 0;
		} finally {
			loading = false;
		}
	}

	function handleSort(column: string) {
		if (sortColumn === column) {
			sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
		} else {
			sortColumn = column;
			sortOrder = 'desc';
		}
		currentPage = 1;
		loadInterviews();
	}

	function handlePageChange(newPage: number) {
		if (newPage < 1 || newPage > totalPages) return;
		currentPage = newPage;
		loadInterviews();
	}

	function handleLimitChange(newLimit: number) {
		itemsPerPage = newLimit;
		currentPage = 1;
		loadInterviews();
	}

	function toggleSelection(id: string) {
		const newSet = new Set(selectedInterviews);
		if (newSet.has(id)) {
			newSet.delete(id);
		} else {
			newSet.add(id);
		}
		selectedInterviews = newSet;
	}

	function toggleSelectAll(event: Event) {
		const checkbox = event.target as HTMLInputElement;
		const newSet = new Set(selectedInterviews);
		if (checkbox.checked) {
			interviews.forEach((i) => newSet.add(i.id));
		} else {
			interviews.forEach((i) => newSet.delete(i.id));
		}
		selectedInterviews = newSet;
	}

	async function handleDeleteSelected() {
		if (
			!confirm(
				`Are you sure you want to delete the selected ${selectedInterviews.size} result(s)? This action cannot be undone.`
			)
		)
			return;

		try {
			await Api.deleteInterviews({
				path: { project_id },
				body: { interview_ids: Array.from(selectedInterviews) }
			});
			selectedInterviews = new Set();
			loadInterviews();
		} catch (e) {
			console.error('Error deleting test results:', e);
			alert('Failed to delete test results');
		}
	}

	async function handleDownloadSelected() {
		try {
			const ids = Array.from(selectedInterviews);
			downloadFile(ids, 'xlsx');
		} catch (e) {
			console.error('Error downloading test results:', e);
			alert('Failed to download test results');
		}
	}

	async function downloadFile(ids: string[], format: 'csv' | 'xlsx') {
		try {
			const response = await Api.exportMessages({
				path: {
					project_id
				},
				body: {
					interview_ids: ids,
					format: format
				},
				parseAs: 'blob'
			});

			if (response.data) {
				const url = window.URL.createObjectURL(response.data as Blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = `test_results_${project_id}.${format}`;
				document.body.appendChild(a);
				a.click();
				window.URL.revokeObjectURL(url);
				document.body.removeChild(a);
			}
		} catch (error) {
			console.error('Error downloading file:', error);
		}
	}

	function handleSingleAction(action: 'view' | 'download' | 'delete', id: string) {
		activeDropdown = null;
		if (action === 'view') {
			const lang = page.params.lang || 'en';
			window
				.open(`/dashboard/projects/${project_id}/${lang}/tests/results/${id}`, '_blank')
				?.focus();
		} else if (action === 'download') {
			downloadFile([id], 'csv');
		} else if (action === 'delete') {
			if (confirm('Are you sure you want to delete this result?')) {
				Api.deleteInterviews({
					path: { project_id },
					body: { interview_ids: [id] }
				}).then(() => loadInterviews());
			}
		}
	}

	function handleConnect(id: string) {
		alert('Not implemented');
	}

	function toggleDropdown(event: MouseEvent, id: string) {
		const target = event.currentTarget as HTMLElement;
		const rect = target.getBoundingClientRect();
		if (activeDropdown === id) {
			activeDropdown = null;
		} else {
			activeDropdown = id;
			dropdownPosition = {
				top: rect.bottom,
				right: window.innerWidth - rect.right
			};
		}
	}

	function handleWindowClick(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('.dropdown-container') && !target.closest('.dropdown-menu')) {
			activeDropdown = null;
		}
	}

	function formatDate(dateStr: string | null | undefined) {
		if (!dateStr) return 'N/A';
		return new Date(dateStr).toLocaleString('en-GB', { hour12: false });
	}

	onMount(() => {
		loadInterviews();
		window.addEventListener('click', handleWindowClick);
		return () => {
			window.removeEventListener('click', handleWindowClick);
		};
	});
</script>

<div class="mb-2 flex items-end justify-between">
	<h1 class="page-title">Test Results</h1>
	<div class="flex gap-1">
		<button
			class="p-2 text-gray-600 transition-transform duration-300 hover:rotate-180 hover:text-gray-900"
			onclick={loadInterviews}
			title="Refresh results"
		>
			<i class="fa-solid fa-arrows-rotate text-lg"></i>
		</button>

		<button
			class="p-2 text-gray-600 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-30"
			onclick={handleDownloadSelected}
			disabled={selectedInterviews.size === 0}
			title="Download selected results"
		>
			<i class="fa-solid fa-download text-lg"></i>
		</button>

		<button
			class="p-2 text-gray-600 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
			onclick={handleDeleteSelected}
			disabled={selectedInterviews.size === 0}
			title="Delete selected results"
		>
			<i class="fa-solid fa-trash-can text-lg"></i>
		</button>
	</div>
</div>

{#if error}
	<div
		class="relative mb-4 rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700"
		role="alert"
	>
		<span class="block sm:inline">{error}</span>
	</div>
{/if}

<div class="overflow-x-auto rounded-lg bg-white shadow">
	<table class="min-w-full leading-normal">
		<thead>
			<tr
				class="border-b-2 border-gray-200 bg-secondary text-left text-[13px] font-bold tracking-wider text-gray-900 uppercase"
			>
				<th class="w-12 px-5 py-3.5">
					<input
						type="checkbox"
						class="form-checkbox h-4 w-4 cursor-pointer text-primary transition duration-150 ease-in-out focus:ring-primary"
						checked={allSelected}
						onchange={toggleSelectAll}
						indeterminate={isIndeterminate}
					/>
				</th>
				{#each columns as col}
					<SortableHeader
						column={col.key}
						label={col.label}
						{sortColumn}
						{sortOrder}
						onSort={handleSort}
					/>
				{/each}
				<th class="px-5 py-3"></th>
				<th class="px-5 py-3"></th>
			</tr>
		</thead>
		<tbody class="bg-white">
			{#if loading}
				<tr>
					<td colspan="10" class="px-5 py-10 text-center text-gray-500">
						<i class="fa-solid fa-spinner fa-spin mr-2"></i> Loading results...
					</td>
				</tr>
			{:else if interviews.length === 0}
				<tr>
					<td colspan="10" class="px-5 py-10 text-center text-gray-500"> No test results found </td>
				</tr>
			{:else}
				{#each interviews as interview (interview.id)}
					<tr class="border-b border-gray-200 text-sm hover:bg-gray-50">
						<td class="px-5 py-4">
							<input
								type="checkbox"
								class="form-checkbox h-4 w-4 cursor-pointer text-primary transition duration-150 ease-in-out focus:ring-primary"
								checked={selectedInterviews.has(interview.id)}
								onchange={() => toggleSelection(interview.id)}
							/>
						</td>
						<td class="px-5 py-4 font-mono text-xs">{interview.id}</td>
						<td class="px-5 py-4">{formatDate(interview.created_at)}</td>
						<td class="px-5 py-4">{formatDate(interview.last_updated)}</td>
						<td class="px-5 py-4">{interview.n_messages}</td>
						<td class="px-5 py-4">{interview.type}</td>
						<td class="px-5 py-4">
							{#if interview.status === 'completed'}
								<span
									class="rounded-full bg-green-100 px-2 py-1 text-xs leading-tight font-semibold text-green-700"
									>Complete</span
								>
							{:else if interview.status === 'active'}
								<span
									class="rounded-full bg-blue-100 px-2 py-1 text-xs leading-tight font-semibold text-blue-700"
									>Active</span
								>
							{:else}
								<span
									class="rounded-full bg-gray-100 px-2 py-1 text-xs leading-tight font-semibold text-gray-700"
									>Inactive</span
								>
							{/if}
						</td>
						<td class="px-5 py-4">
							{#if interview.interviewer !== 'ai' && interview.status === 'active'}
								<button
									class="rounded bg-blue-500 px-3 py-1 text-xs font-bold text-white transition duration-150 hover:bg-blue-600"
									onclick={() => handleConnect(interview.id)}
								>
									Join
								</button>
							{/if}
						</td>
						<td class="px-5 py-4 text-right">
							<div class="dropdown-container relative">
								<button
									class="w-4 text-gray-500 hover:text-gray-700 focus:outline-none"
									onclick={(e) => {
										e.stopPropagation();
										toggleDropdown(e, interview.id);
									}}
									aria-label="Actions"
								>
									<i class="fa-solid fa-ellipsis-vertical"></i>
								</button>
							</div>
						</td>
					</tr>
				{/each}
			{/if}
		</tbody>
	</table>
</div>

<TablePaginationFooter
	{totalItems}
	{itemsPerPage}
	{currentPage}
	onPageChange={handlePageChange}
	onItemsPerPageChange={handleLimitChange}
	itemName="results"
/>

{#if activeDropdown}
	<div
		class="dropdown-menu fixed z-50 mt-2 w-48 rounded-md border border-gray-100 bg-white py-1 text-left shadow-lg"
		style="top: {dropdownPosition.top}px; right: {dropdownPosition.right}px;"
	>
		<button
			class="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
			onclick={() => handleSingleAction('view', activeDropdown!)}
		>
			<i class="fa-solid fa-eye mr-2 text-gray-500"></i> View
		</button>
		<button
			class="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
			onclick={() => handleSingleAction('download', activeDropdown!)}
		>
			<i class="fa-solid fa-download mr-2 text-gray-500"></i> Download
		</button>
		<button
			class="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
			onclick={() => handleSingleAction('delete', activeDropdown!)}
		>
			<i class="fa-solid fa-trash-can mr-2"></i> Delete
		</button>
	</div>
{/if}

<style>
	.dropdown-container {
		position: relative;
	}
</style>
