<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { Admin, type Scope } from '$lib/api';
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

	let requests = $state<AccessRequest[]>(data.requests);
	let isLoading = $state(false);
	let error = $state<string | null>(data.error);
	let selectedIds = $state<Set<string>>(new Set());
	let scopeByRequest = $state<Record<string, Scope>>({});

	const scopeOptions: Scope[] = ['admin', 'user', 'demo', 'guest'];
	const scopeColors: Record<string, string> = {
		admin: 'bg-purple-100 text-purple-800',
		user: 'bg-blue-100 text-blue-800',
		demo: 'bg-amber-100 text-amber-800',
		guest: 'bg-gray-100 text-gray-800'
	};

	let allSelected = $derived(requests.length > 0 && selectedIds.size === requests.length);

	$effect(() => {
		const nextRequests = data.requests;
		requests = nextRequests;
		error = data.error;
		scopeByRequest = Object.fromEntries(nextRequests.map((r) => [r.id, 'user' as Scope]));
	});

	async function loadRequests() {
		if (isLoading) return;
		isLoading = true;
		error = null;
		try {
			await invalidateAll();
			selectedIds = new Set();
		} catch (e: any) {
			error = e.message || 'Failed to fetch requests';
		} finally {
			isLoading = false;
		}
	}

	function toggleSelection(id: string) {
		const newSet = new Set(selectedIds);
		if (newSet.has(id)) {
			newSet.delete(id);
		} else {
			newSet.add(id);
		}
		selectedIds = newSet;
	}

	function toggleAll(checked: boolean) {
		if (checked) {
			selectedIds = new Set(requests.map((r) => r.id));
		} else {
			selectedIds = new Set();
		}
	}

	async function handleAction(action: 'approve' | 'deny') {
		const ids = Array.from(selectedIds);
		if (ids.length === 0) {
			toast.error(`Please select one or more requests to ${action}.`);
			return;
		}

		isLoading = true;
		try {
			const response = await Admin.processAccessRequests({
				body: {
					ids: ids,
					scopes: ids.map((id) => scopeByRequest[id] ?? 'user'),
					action: action
				}
			});
			if (response.error) {
				throw new Error(String(response.error));
			}
			// Reset loading state so loadRequests can proceed (avoid deadlock)
			isLoading = false;
			await loadRequests();
			toast.success(`Requests ${action === 'approve' ? 'approved' : 'denied'}`);
		} catch (e: any) {
			error = `Failed to ${action} requests: ${e.message}`;
			toast.error(error);
			isLoading = false;
		}
	}

	async function handleDelete() {
		const ids = Array.from(selectedIds);
		if (ids.length === 0) {
			toast.error('Please select one or more requests to delete.');
			return;
		}

		if (!confirm('Are you sure you want to delete these requests?')) {
			return;
		}

		isLoading = true;
		try {
			const response = await Admin.deleteAccessRequests({
				body: {
					ids: ids
				}
			});
			if (response.error) {
				throw new Error(String(response.error));
			}
			isLoading = false;
			await loadRequests();
			toast.success('Requests deleted');
		} catch (e: any) {
			error = `Failed to delete requests: ${e.message}`;
			toast.error(error);
			isLoading = false;
		}
	}
</script>

<svelte:head>
	<title>AInterviewer - Access Requests</title>
</svelte:head>

<div class="mb-4 flex items-end justify-between">
	<h2 class="page-title">Access Requests</h2>
	<div class="flex gap-2">
		<button
			class="cursor-pointer rounded bg-green-600 p-2 text-white transition hover:bg-green-700 disabled:opacity-50"
			onclick={() => handleAction('approve')}
			title="Accept selected requests"
			disabled={selectedIds.size === 0 || isLoading}
		>
			<i class="fa-solid fa-circle-check"></i>
		</button>
		<button
			class="cursor-pointer rounded bg-red-600 p-2 text-white transition hover:bg-red-700 disabled:opacity-50"
			onclick={() => handleAction('deny')}
			title="Deny selected requests"
			disabled={selectedIds.size === 0 || isLoading}
		>
			<i class="fa-solid fa-ban"></i>
		</button>
		<button
			class="cursor-pointer rounded bg-gray-600 p-2 text-white transition hover:bg-gray-700 disabled:opacity-50"
			onclick={handleDelete}
			title="Delete selected requests"
			disabled={selectedIds.size === 0 || isLoading}
		>
			<i class="fa-solid fa-trash"></i>
		</button>
		<button
			class="cursor-pointer rounded bg-blue-600 p-2 text-white transition hover:bg-blue-700 disabled:opacity-50"
			onclick={loadRequests}
			title="Refresh requests"
			disabled={isLoading}
		>
			<i class="fa-solid fa-arrows-rotate {isLoading ? 'animate-spin' : ''}"></i>
		</button>
	</div>
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

<div class="overflow-hidden rounded-lg bg-white shadow-md">
	<table class="min-w-full divide-y divide-gray-200">
		<colgroup>
			<col style="width: 50px" />
			<col style="width: 150px" />
			<col style="width: 220px" />
			<col style="width: 120px" />
			<col style="width: 100px" />
			<col style="width: 120px" />
			<col style="width: auto" />
			<col style="width: 160px" />
			<col style="width: 160px" />
		</colgroup>
		<thead class="bg-gray-50">
			<tr>
				<th class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
					<input
						type="checkbox"
						checked={allSelected}
						onchange={(e) => toggleAll(e.currentTarget.checked)}
						class="cursor-pointer rounded border-gray-300 text-primary focus:ring-primary"
					/>
				</th>
				<th class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
					>Name</th
				>
				<th class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
					>Email</th
				>
				<th class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
					>Organization</th
				>
				<th class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
					>Status</th
				>
				<th class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
					>Scope</th
				>
				<th class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
					>Message</th
				>
				<th class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
					>Created at</th
				>
				<th class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
					>Updated at</th
				>
			</tr>
		</thead>
		<tbody class="divide-y divide-gray-200 bg-white">
			{#if isLoading && requests.length === 0}
				<tr>
					<td colspan="9" class="px-6 py-4 text-center text-gray-500"> Loading requests... </td>
				</tr>
			{:else if requests.length === 0}
				<tr>
					<td colspan="9" class="px-6 py-4 text-center text-gray-500">
						No access requests found.
					</td>
				</tr>
			{:else}
				{#each requests as request (request.id)}
					<tr
						class="cursor-pointer hover:bg-gray-50"
						tabindex="0"
						onclick={() => toggleSelection(request.id)}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								toggleSelection(request.id);
							}
						}}
					>
						<td class="px-6 py-4 whitespace-nowrap">
							<input
								type="checkbox"
								checked={selectedIds.has(request.id)}
								onchange={() => toggleSelection(request.id)}
								onclick={(e) => e.stopPropagation()}
								class="cursor-pointer rounded border-gray-300 text-primary focus:ring-primary"
							/>
						</td>
						<td class="px-6 py-4 text-sm whitespace-nowrap text-gray-900">{request.name}</td>
						<td class="px-6 py-4 text-sm whitespace-nowrap text-gray-900">{request.email}</td>
						<td class="px-6 py-4 text-sm whitespace-nowrap text-gray-500"
							>{request.organization || '-'}</td
						>
						<td class="px-6 py-4 whitespace-nowrap">
							<span
								class="inline-flex rounded-full px-2 text-xs leading-5 font-semibold capitalize
                                    {request.status === 'fulfilled'
									? 'bg-green-100 text-green-800'
									: request.status === 'denied' || request.status === 'error'
										? 'bg-red-100 text-red-800'
										: 'bg-orange-100 text-orange-800'}"
							>
								{request.status}
							</span>
						</td>
						<td class="px-6 py-4 whitespace-nowrap">
							<select
								value={scopeByRequest[request.id] ?? 'user'}
								onclick={(e) => e.stopPropagation()}
								onchange={(e) => {
									const value = e.currentTarget.value as Scope;
									scopeByRequest = { ...scopeByRequest, [request.id]: value };
								}}
								class="w-24 rounded-md border border-gray-300 px-2 py-1 text-xs font-medium {scopeColors[
									scopeByRequest[request.id] ?? 'user'
								]} focus:border-primary focus:ring-primary focus:outline-none"
							>
								{#each scopeOptions as scope}
									<option value={scope}>{scope}</option>
								{/each}
							</select>
						</td>
						<td
							class="max-w-xs truncate px-6 py-4 text-sm text-gray-500"
							title={request.message || ''}>{request.message || '-'}</td
						>
						<td class="px-6 py-4 text-sm whitespace-nowrap text-gray-500"
							>{new Date(request.created_at).toLocaleString()}</td
						>
						<td class="px-6 py-4 text-sm whitespace-nowrap text-gray-500"
							>{new Date(request.updated_at).toLocaleString()}</td
						>
					</tr>
				{/each}
			{/if}
		</tbody>
	</table>
</div>
