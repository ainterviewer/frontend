<script lang="ts">
	import { Admin } from '$lib/api';
	import toast from 'svelte-hot-french-toast';
	import { onMount } from 'svelte';
	import type { Instance } from './types';

	let instances: Instance[] = $state([]);
	let selectedInstances: Set<string> = $state(new Set());
	let isLoading = $state(false);
	let error = $state('');
	let minInstances = $state(0);
	let allSelected = $derived(instances.length > 0 && selectedInstances.size === instances.length);

	function formatTimeEstimate(seconds: number) {
		const decimalHours = seconds / 3600;
		const hours = Math.floor(decimalHours);
		const minutes = Math.round((decimalHours - hours) * 60);

		if (hours) {
			return `${hours} hours ${minutes} min.`;
		} else {
			return `${minutes} min.`;
		}
	}

	async function getInstanceStatus() {
		if (isLoading) return;
		isLoading = true;
		error = '';

		try {
			const response = await Admin.proxyToEc2Manager2({
				path: { full_path: 'instances/status' }
			});

			if (response.error) {
				throw new Error('Failed to fetch status');
			}

			instances = response.data as Instance[];
		} catch (err: any) {
			console.error(err);
			error = 'Failed to fetch instance status: ' + (err.message || 'Unknown error');
		} finally {
			isLoading = false;
		}
	}

	async function getSettings() {
		try {
			const response = await Admin.proxyToEc2Manager2({
				path: { full_path: 'settings/min-instances' }
			});
			if (response.data !== undefined) {
				minInstances = Number(response.data);
			}
		} catch (err) {
			console.error('Failed to fetch settings:', err);
		}
	}

	async function updateSettings() {
		try {
			await Admin.proxyToEc2Manager4({
				path: { full_path: 'settings/min-instances' },
				body: minInstances
			});

			toast.success('Min instances updated');
		} catch (err: any) {
			toast.error('Failed to update settings: ' + err.message);
		}
	}

	function toggleInstance(id: string) {
		const newSelected = new Set(selectedInstances);
		if (newSelected.has(id)) {
			newSelected.delete(id);
		} else {
			newSelected.add(id);
		}
		selectedInstances = newSelected;
	}

	function toggleAll(checked: boolean) {
		if (checked) {
			selectedInstances = new Set(instances.map((i) => i.id));
		} else {
			selectedInstances = new Set();
		}
	}

	async function startSelected() {
		if (selectedInstances.size === 0) return;

		try {
			if (selectedInstances.size === instances.length) {
				await Admin.proxyToEc2Manager4({
					path: { full_path: 'instances/start-all' }
				});
			} else {
				await Promise.all(
					Array.from(selectedInstances).map((id) =>
						Admin.proxyToEc2Manager4({
							path: { full_path: `instances/start/${id}` }
						})
					)
				);
			}
			await getInstanceStatus();
			selectedInstances = new Set();
			toast.success('Instances starting');
		} catch (err: any) {
			error = 'Failed to start instances: ' + err.message;
			toast.error(error);
		}
	}

	async function stopSelected() {
		if (selectedInstances.size === 0) return;

		try {
			if (selectedInstances.size === instances.length) {
				await Admin.proxyToEc2Manager4({
					path: { full_path: 'instances/stop-all' }
				});
			} else {
				await Promise.all(
					Array.from(selectedInstances).map((id) =>
						Admin.proxyToEc2Manager4({
							path: { full_path: `instances/stop/${id}` }
						})
					)
				);
			}
			await getInstanceStatus();
			selectedInstances = new Set();
			toast.success('Instances stopping');
		} catch (err: any) {
			error = 'Failed to stop instances: ' + err.message;
			toast.error(error);
		}
	}

	function getStatusColor(status: string) {
		const s = status.toLowerCase();
		if (s === 'running' || s === 'success') return 'bg-green-100 text-green-800 ring-green-600/20';
		if (s === 'stopped' || s === 'error') return 'bg-red-100 text-red-800 ring-red-600/20';
		if (['starting', 'pending', 'stopping'].includes(s))
			return 'bg-yellow-100 text-yellow-800 ring-yellow-600/20';
		return 'bg-gray-100 text-gray-800 ring-gray-500/10';
	}

	onMount(() => {
		getSettings();
		getInstanceStatus();
	});
</script>

<div class="sm:flex sm:items-center">
	<div class="sm:flex-auto">
		<h1 class="page-title">Admin</h1>
		<p class="mt-2 text-sm text-gray-700">Manage your EC2 instances and settings.</p>
	</div>
</div>

<div class="mt-8 flex items-end justify-between border-b border-gray-200 pb-4">
	<h2 class="text-xl leading-6 font-bold text-gray-900">EC2 Instances</h2>
	<div class="flex gap-2">
		<button
			type="button"
			class="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
			onclick={startSelected}
			disabled={selectedInstances.size === 0}
			title="Start selected instances"
		>
			<i class="fa-solid fa-play mr-1.5 text-green-600"></i> Start
		</button>
		<button
			type="button"
			class="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
			onclick={stopSelected}
			disabled={selectedInstances.size === 0}
			title="Stop selected instances"
		>
			<i class="fa-solid fa-stop mr-1.5 text-red-600"></i> Stop
		</button>
		<button
			type="button"
			class="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
			onclick={getInstanceStatus}
			disabled={isLoading}
			title="Refresh status"
		>
			<i class="fa-solid fa-arrows-rotate text-gray-600 {isLoading ? 'animate-spin' : ''}"></i>
		</button>
	</div>
</div>

{#if error}
	<div class="mt-4 rounded-md bg-red-50 p-4">
		<div class="flex">
			<div class="flex-shrink-0">
				<i class="fa-solid fa-circle-exclamation text-red-400"></i>
			</div>
			<div class="ml-3">
				<h3 class="text-sm font-medium text-red-800">Error</h3>
				<div class="mt-2 text-sm text-red-700">
					<p>{error}</p>
				</div>
			</div>
		</div>
	</div>
{/if}

<div class="mt-8 flow-root">
	<div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
		<div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
			<div class="ring-opacity-5 relative overflow-hidden shadow ring-1 ring-black sm:rounded-lg">
				{#if isLoading && instances.length === 0}
					<div class="flex items-center justify-center py-12">
						<div
							class="text-surface h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-e-transparent align-[-0.125em] text-indigo-600 motion-reduce:animate-[spin_1.5s_linear_infinite] dark:text-white"
							role="status"
						>
							<span
								class="!absolute !-m-px !h-px !w-px !overflow-hidden !border-0 !p-0 !whitespace-nowrap ![clip:rect(0,0,0,0)]"
								>Loading...</span
							>
						</div>
						<span class="ml-3 text-sm text-gray-500">Loading instance data...</span>
					</div>
				{:else}
					<table class="min-w-full divide-y divide-gray-300 {isLoading ? 'opacity-50' : ''}">
						<thead class="bg-gray-50">
							<tr>
								<th scope="col" class="relative px-7 sm:w-12 sm:px-6"></th>
								<th
									scope="col"
									class="py-3.5 pr-3 pl-4 text-left text-sm font-semibold text-gray-900 sm:pl-0"
								></th>
								<th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
								></th>
								<th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
								></th>
								<th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
								></th>
								<th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
								></th>
								<th
									scope="col"
									colspan="4"
									class="border-l border-dashed border-gray-400 px-3 py-3.5 text-center text-sm font-semibold text-gray-900"
								>
									vLLM
								</th>
							</tr>
							<tr>
								<th scope="col" class="relative px-7 sm:w-12 sm:px-6">
									<input
										type="checkbox"
										class="absolute top-1/2 left-4 -mt-2 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
										checked={allSelected}
										onchange={(e) => toggleAll(e.currentTarget.checked)}
									/>
								</th>
								<th
									scope="col"
									class="py-3.5 pr-3 pl-4 text-left text-sm font-semibold text-gray-900"
									>Instance Name</th
								>
								<th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
									>State</th
								>
								<th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
									>Type</th
								>
								<th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
									>ID</th
								>
								<th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
									>Model</th
								>
								<th
									scope="col"
									class="border-l border-dashed border-gray-400 px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
									>Status</th
								>
								<th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
									>Model</th
								>
								<th scope="col" class="px-3 py-3.5 text-center text-sm font-semibold text-gray-900"
									>Conn.</th
								>
								<th scope="col" class="px-3 py-3.5 text-right text-sm font-semibold text-gray-900"
									>Idle</th
								>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-200 bg-white">
							{#each instances as instance (instance.id)}
								<tr
									class="cursor-pointer hover:bg-gray-50 {selectedInstances.has(instance.id)
										? 'bg-gray-50'
										: ''}"
									onclick={(e) => {
										if (e.target.type !== 'checkbox') toggleInstance(instance.id);
									}}
								>
									<td class="relative px-7 sm:w-12 sm:px-6">
										{#if selectedInstances.has(instance.id)}
											<div class="absolute inset-y-0 left-0 w-0.5 bg-indigo-600"></div>
										{/if}
										<input
											type="checkbox"
											class="absolute top-1/2 left-4 -mt-2 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
											checked={selectedInstances.has(instance.id)}
											onchange={() => toggleInstance(instance.id)}
											onclick={(e) => e.stopPropagation()}
										/>
									</td>
									<td class="py-4 pr-3 pl-4 text-sm font-medium whitespace-nowrap text-gray-900"
										>{instance.name}</td
									>
									<td class="px-3 py-4 text-sm whitespace-nowrap text-gray-500">
										<span
											class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset {getStatusColor(
												instance.state
											)}"
										>
											{instance.state}
										</span>
									</td>
									<td class="px-3 py-4 text-sm whitespace-nowrap text-gray-500"
										>{instance.instance_type}</td
									>
									<td class="px-3 py-4 font-mono text-xs whitespace-nowrap text-gray-500"
										>{instance.id}</td
									>
									<td class="px-3 py-4 text-sm whitespace-nowrap text-gray-500"
										>{instance.model ?? '-'}</td
									>
									<td
										class="border-l border-dashed border-gray-300 px-3 py-4 text-sm whitespace-nowrap text-gray-500"
									>
										<span
											class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset {getStatusColor(
												instance.vllm.status
											)}"
										>
											{instance.vllm.status}
										</span>
									</td>
									<td class="px-3 py-4 text-sm whitespace-nowrap text-gray-500"
										>{instance.vllm.models?.[0]?.name ?? '-'}</td
									>
									<td class="px-3 py-4 text-center text-sm whitespace-nowrap text-gray-500"
										>{instance.connections}</td
									>
									<td class="px-3 py-4 text-right text-sm whitespace-nowrap text-gray-500"
										>{formatTimeEstimate(instance.idle_time)}</td
									>
								</tr>
							{/each}
						</tbody>
					</table>
				{/if}
			</div>
		</div>
	</div>
</div>

<div class="mt-8 rounded-lg bg-gray-50 p-4 shadow-sm ring-1 ring-gray-900/5 sm:max-w-md">
	<h3 class="text-base leading-7 font-semibold text-gray-900">Configuration</h3>
	<div class="mt-4 flex items-center gap-x-4">
		<label for="min-instances" class="block text-sm leading-6 font-medium text-gray-900"
			>Minimum Instances</label
		>
		<div class="flex-none">
			<input
				type="number"
				id="min-instances"
				bind:value={minInstances}
				class="block w-20 rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-600 focus:ring-inset sm:text-sm sm:leading-6"
			/>
		</div>
		<button
			type="button"
			class="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
			onclick={updateSettings}
		>
			Update
		</button>
	</div>
</div>
