<script lang="ts">
	import Sidebar from '$lib/components/Sidebar.svelte';
	import { mainSidebarItems } from '$lib/config/sidebar';
	import { Experiments } from '$lib/api/sdk.gen';
	import { toast } from 'svelte-sonner';
	import type { PageData } from './$types';
	import { fade } from 'svelte/transition';
	import type { ProjectFolderWithProjects } from '$lib/api/types.gen';

	interface Experiment {
		id: string;
		title: string;
		status: string;
		weights: number[];
		project_ids: string[];
	}

	let { data }: { data: PageData } = $props();

	// eslint-disable-next-line svelte/prefer-writable-derived
	let experiments = $state<Experiment[]>(data.experiments as unknown as Experiment[]);
	let folders = $derived<ProjectFolderWithProjects[]>(
		data.folders as unknown as ProjectFolderWithProjects[]
	);

	// Sync local state with data prop when it changes (e.g. navigation/invalidation)
	$effect(() => {
		experiments = data.experiments as unknown as Experiment[];
	});

	let isCreateModalOpen = $state(false);
	let isDeleteModalOpen = $state(false);
	let isQRModalOpen = $state(false);

	let selectedExperiment = $state<Experiment | null>(null);
	let qrCodeUrl = $state<string | null>(null);
	let openDropdownId = $state<string | null>(null);
	let dropdownPosition = $state<{ top: number; left: number } | null>(null);

	// Create Form State
	let newExperimentTitle = $state('');
	let selectedProjectIds = $state<string[]>([]);
	let projectWeights = $state<Record<string, number>>({});

	// Delete Form State
	let deleteConfirmationText = $state('');

	// Close dropdowns on outside click
	function handleWindowClick(event: MouseEvent) {
		const target = event.target as Element;
		if (
			openDropdownId &&
			!target.closest('.dropdown-trigger') &&
			!target.closest('.dropdown-menu')
		) {
			openDropdownId = null;
			dropdownPosition = null;
		}
	}

	function toggleDropdown(id: string, event: MouseEvent) {
		if (openDropdownId === id) {
			openDropdownId = null;
			dropdownPosition = null;
		} else {
			const button = event.currentTarget as HTMLElement;
			const rect = button.getBoundingClientRect();

			openDropdownId = id;
			dropdownPosition = {
				top: rect.bottom + window.scrollY,
				left: rect.right + window.scrollX - 192 // 192px = w-48 (12rem)
			};
		}
	}

	function openCreateModal() {
		newExperimentTitle = '';
		selectedProjectIds = [];
		projectWeights = {};
		isCreateModalOpen = true;
	}

	function openDeleteModal(experiment: Experiment) {
		selectedExperiment = experiment;
		deleteConfirmationText = '';
		isDeleteModalOpen = true;
	}

	function openQRModal(experiment: Experiment) {
		selectedExperiment = experiment;
		qrCodeUrl = null;

		// Fetch QR Code
		Experiments.generateExperimentQr({
			path: { experiment_id: experiment.id }
		})
			.then((response) => {
				if (response.data) {
					const blob = response.data as unknown as Blob;
					qrCodeUrl = URL.createObjectURL(blob);
				}
			})
			.catch((err) => {
				console.error('Failed to fetch QR', err);
				fetch(`/api/experiments/${experiment.id}/qr.png`)
					.then((res) => res.blob())
					.then((blob) => {
						qrCodeUrl = URL.createObjectURL(blob);
					});
			});

		isQRModalOpen = true;
	}

	function copyToClipboard(blob: Blob) {
		try {
			navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
			toast.success('QR Code copied to clipboard');
		} catch (e) {
			console.error(e);
			toast.error('Failed to copy image');
		}
	}

	async function handleCreate() {
		const weights = selectedProjectIds.map((id) => projectWeights[id] || 0);

		try {
			const response = await Experiments.createExperiment({
				body: {
					title: newExperimentTitle,
					projects: selectedProjectIds.map(function (project_id, i) {
						return { project_id: project_id, weight: weights[i] };
					})
				}
			});

			if (response.data) {
				experiments = [...experiments, response.data as unknown as Experiment];
				isCreateModalOpen = false;
			}
		} catch (error) {
			console.error('Failed to create experiment', error);
			toast.error('Failed to create experiment');
		}
	}

	async function handleDelete() {
		if (!selectedExperiment) return;

		try {
			await Experiments.deleteExperiment({
				path: { experiment_id: selectedExperiment.id }
			});
			experiments = experiments.filter((e) => e.id !== selectedExperiment!.id);
			isDeleteModalOpen = false;
			selectedExperiment = null;
		} catch (error) {
			console.error('Failed to delete experiment', error);
			toast.error('Failed to delete experiment');
		}
	}

	function copyLink(experiment: Experiment) {
		const url = `${window.location.origin}/interview/redirect?id=${experiment.id}`;
		navigator.clipboard.writeText(url);
		toast.success('Link copied to clipboard!');
	}

	function getStatusClass(status: string) {
		switch (status) {
			case 'running':
			case 'success':
				return 'bg-green-100 text-green-800 border-green-200';
			case 'stopped':
			case 'error':
				return 'bg-red-100 text-red-800 border-red-200';
			case 'starting':
			case 'pending':
			case 'stopping':
				return 'bg-orange-100 text-orange-800 border-orange-200';
			default:
				return 'bg-gray-100 text-gray-800 border-gray-200';
		}
	}

	function handleCheckboxChange(projectId: string, event: Event) {
		const checked = (event.target as HTMLInputElement).checked;
		if (checked) {
			projectWeights[projectId] = 1;
		} else {
			delete projectWeights[projectId];
		}
	}
</script>

<svelte:window onclick={handleWindowClick} />

<Sidebar items={mainSidebarItems} />

<div class="mb-4 flex items-end justify-between">
	<div>
		<h1 class="page-title">Experiments</h1>
		<p class="mr-2 text-gray-600">
			Experiments allows you to combine multiple different projects, share a single url, and then
			have users distributed based on your specified probabilities.
		</p>
	</div>
	<button
		class="flex items-center gap-2 rounded bg-primary px-4 py-2 whitespace-nowrap text-white transition-colors hover:bg-dark"
		onclick={openCreateModal}
		title="Create new experiment"
	>
		<i class="fa-solid fa-plus"></i> New Experiment
	</button>
</div>

<div class="ring-opacity-5 overflow-hidden rounded-lg bg-white shadow ring-1 ring-black">
	<table class="min-w-full divide-y divide-gray-300">
		<thead class="bg-gray-50">
			<tr>
				<th
					scope="col"
					class="w-16 py-3.5 pr-3 pl-4 text-left text-sm font-semibold text-gray-900 sm:pl-6"
				></th>
				<th scope="col" class="py-3.5 pr-3 pl-4 text-left text-sm font-semibold text-gray-900"
					>Experiment</th
				>
				<th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Status</th
				>
				<th scope="col" class="px-3 py-3.5 text-center text-sm font-semibold text-gray-900"
					>Weights</th
				>
				<th scope="col" class="relative w-20 py-3.5 pr-4 pl-3 sm:pr-6"></th>
			</tr>
		</thead>
		<tbody class="divide-y divide-gray-200 bg-white">
			{#each experiments as experiment (experiment.id)}
				<tr class="transition-colors hover:bg-gray-50">
					<td class="py-4 pr-3 pl-4 text-gray-400 sm:pl-6">
						<i class="fa-solid fa-vial"></i>
					</td>
					<td class="py-4 pr-3 pl-4 text-sm font-medium whitespace-nowrap text-gray-900">
						{experiment.title || experiment.id}
					</td>
					<td class="px-3 py-4 text-sm whitespace-nowrap">
						<span
							class="rounded-full border px-3 py-1 text-xs font-semibold {getStatusClass(
								experiment.status
							)}"
						>
							{experiment.status}
						</span>
					</td>
					<td class="px-3 py-4 text-center text-sm whitespace-nowrap text-gray-600">
						{#if experiment.weights}
							{experiment.weights.map((w: number) => w.toFixed(2)).join(' ')}
						{/if}
					</td>
					<td
						class="relative py-4 pr-4 pl-3 text-right text-sm font-medium whitespace-nowrap sm:pr-6"
					>
						<button
							class="dropdown-trigger rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
							onclick={(e) => {
								e.stopPropagation();
								toggleDropdown(experiment.id, e);
							}}
							aria-label="Experiment options"
						>
							<i class="fa-solid fa-ellipsis-vertical"></i>
						</button>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
	{#if experiments.length === 0}
		<div class="p-8 text-center text-gray-500">
			No experiments found. Create one to get started.
		</div>
	{/if}
</div>

<!-- Dropdown Portal -->
{#if openDropdownId && dropdownPosition}
	{@const experiment = experiments.find((e) => e.id === openDropdownId)}
	<div
		transition:fade={{ duration: 100 }}
		class="dropdown-menu absolute z-50 w-48 rounded-md border border-gray-100 bg-white py-1 shadow-lg"
		style="top: {dropdownPosition.top}px; left: {dropdownPosition.left}px;"
	>
		{#if experiment}
			<button
				class="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
				onclick={() => {
					copyLink(experiment);
					openDropdownId = null;
					dropdownPosition = null;
				}}
			>
				<i class="fa-solid fa-copy w-4"></i> Copy link
			</button>
			<button
				class="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
				onclick={() => {
					openQRModal(experiment);
					openDropdownId = null;
					dropdownPosition = null;
				}}
			>
				<i class="fa-solid fa-qrcode w-4"></i> QR code
			</button>
			<button
				class="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
				onclick={() => {
					/* Edit logic would go here */
					openDropdownId = null;
					dropdownPosition = null;
				}}
			>
				<i class="fa-solid fa-pen-to-square w-4"></i> Edit
			</button>
			<button
				class="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
				onclick={() => {
					openDeleteModal(experiment);
					openDropdownId = null;
					dropdownPosition = null;
				}}
			>
				<i class="fa-solid fa-trash-can w-4"></i> Delete
			</button>
		{/if}
	</div>
{/if}

<!-- Create Modal -->
{#if isCreateModalOpen}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
		transition:fade={{ duration: 150 }}
	>
		<div class="w-full max-w-md overflow-hidden rounded-lg bg-white shadow-xl">
			<div class="flex items-center justify-between border-b border-gray-100 p-6">
				<h2 class="text-xl font-semibold text-gray-800">Create New Experiment</h2>
				<button
					class="text-gray-400 hover:text-gray-600"
					onclick={() => (isCreateModalOpen = false)}
					aria-label="Close modal"
				>
					<i class="fa-solid fa-xmark"></i>
				</button>
			</div>
			<div class="space-y-4 p-6">
				<div>
					<label for="experiment-name" class="mb-1 block text-sm font-medium text-gray-700"
						>Experiment Title</label
					>
					<input
						type="text"
						id="experiment-name"
						bind:value={newExperimentTitle}
						class="w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
						required
					/>
				</div>
				<fieldset class="rounded-md border border-gray-200 p-4">
					<legend class="px-2 text-sm font-medium text-gray-700">Projects</legend>
					<div class="max-h-60 space-y-4 overflow-y-auto">
						{#each folders as folder (folder.id)}
							{#if folder.projects.length > 0}
								<div>
									<h3 class="mb-2 text-xs font-semibold text-gray-500 uppercase">{folder.title}</h3>
									<div class="space-y-2 pl-2">
										{#each folder.projects as project (project.id)}
											<div class="flex items-center justify-between">
												<label class="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
													<input
														type="checkbox"
														value={project.id}
														bind:group={selectedProjectIds}
														onchange={(e) => handleCheckboxChange(project.id, e)}
														class="rounded border-gray-300 text-primary focus:ring-primary"
													/>
													{project.title}
												</label>
												{#if selectedProjectIds.includes(project.id)}
													<div class="flex items-center gap-2" transition:fade>
														<span class="text-xs text-gray-500">Weight:</span>
														<input
															type="number"
															bind:value={projectWeights[project.id]}
															min="0"
															step="0.01"
															class="h-8 w-20 rounded-md border-gray-300 text-sm focus:border-primary focus:ring-primary"
														/>
													</div>
												{/if}
											</div>
										{/each}
									</div>
								</div>
							{/if}
						{/each}
						{#if folders.length === 0}
							<p class="text-sm text-gray-500 italic">No projects available.</p>
						{/if}
					</div>
				</fieldset>
			</div>
			<div class="flex justify-end gap-3 border-t border-gray-100 bg-gray-50 p-6">
				<button
					class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
					onclick={() => (isCreateModalOpen = false)}
				>
					Cancel
				</button>
				<button
					class="hover:bg-opacity-90 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
					onclick={handleCreate}
					disabled={!newExperimentTitle || selectedProjectIds.length === 0}
				>
					Create
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Delete Modal -->
{#if isDeleteModalOpen}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
		transition:fade={{ duration: 150 }}
	>
		<div class="w-full max-w-md rounded-lg bg-white shadow-xl">
			<div class="flex items-center justify-between border-b border-gray-100 p-6">
				<h2 class="text-xl font-semibold text-gray-800">Delete Experiment</h2>
				<button
					class="text-gray-400 hover:text-gray-600"
					onclick={() => (isDeleteModalOpen = false)}
					aria-label="Close modal"
				>
					<i class="fa-solid fa-xmark"></i>
				</button>
			</div>
			<div class="space-y-4 p-6">
				<div class="text-gray-600">
					Are you sure you want to delete <span class="font-bold text-gray-900"
						>{selectedExperiment?.title || selectedExperiment?.id}</span
					>?
					<br />
					This action cannot be undone.
				</div>
				<div>
					<label for="delete-confirm" class="mb-1 block text-sm font-medium text-gray-700">
						To confirm, type "<span class="font-mono font-bold"
							>{selectedExperiment?.title || selectedExperiment?.id}</span
						>" below:
					</label>
					<input
						type="text"
						id="delete-confirm"
						bind:value={deleteConfirmationText}
						class="w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500"
					/>
				</div>
			</div>
			<div class="flex justify-end gap-3 border-t border-gray-100 bg-gray-50 p-6">
				<button
					class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
					onclick={() => (isDeleteModalOpen = false)}
				>
					Cancel
				</button>
				<button
					class="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
					onclick={handleDelete}
					disabled={deleteConfirmationText !==
						(selectedExperiment?.title || selectedExperiment?.id)}
				>
					Delete
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- QR Modal -->
{#if isQRModalOpen}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
		transition:fade={{ duration: 150 }}
	>
		<div class="w-full max-w-sm rounded-lg bg-white shadow-xl">
			<div class="flex items-center justify-between border-b border-gray-100 p-6">
				<h2 class="text-xl font-semibold text-gray-800">QR Code</h2>
				<button
					class="text-gray-400 hover:text-gray-600"
					onclick={() => (isQRModalOpen = false)}
					aria-label="Close modal"
				>
					<i class="fa-solid fa-xmark"></i>
				</button>
			</div>
			<div class="flex min-h-[300px] flex-col items-center justify-center p-6">
				{#if qrCodeUrl}
					<img src={qrCodeUrl} alt="QR Code" class="h-64 w-64 rounded border border-gray-100" />
				{:else}
					<div
						class="flex h-64 w-64 items-center justify-center rounded border border-gray-100 bg-gray-50 text-gray-400"
					>
						<i class="fa-solid fa-spinner fa-spin text-2xl"></i>
					</div>
				{/if}
			</div>
			<div class="flex justify-end gap-3 border-t border-gray-100 bg-gray-50 p-6">
				<button
					class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
					onclick={() => (isQRModalOpen = false)}
				>
					Close
				</button>
				<button
					class="hover:bg-opacity-90 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
					onclick={() => {
						// We need the blob here. If qrCodeUrl is object URL, we can fetch it back or store blob.
						// For simplicity, just fetch it again or alert user if copy fails.
						// But actually navigator.clipboard.write works with Blob.
						fetch(qrCodeUrl!)
							.then((r) => r.blob())
							.then(copyToClipboard);
					}}
					disabled={!qrCodeUrl}
				>
					Copy
				</button>
			</div>
		</div>
	</div>
{/if}
