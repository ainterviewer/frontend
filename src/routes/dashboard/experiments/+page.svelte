<script lang="ts">
	import { createColumnHelper, createTable } from '@tanstack/svelte-table';
	import { fade } from 'svelte/transition';
	import { toast } from 'svelte-sonner';

	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { Experiments } from '$lib/api/sdk.gen';
	import type {
		ExperimentAllocation,
		ExperimentCreate,
		ExperimentProjectCreate,
		ExperimentPublic,
		FolderWithProjectsPublic,
		ProjectPublic
	} from '$lib/api/types.gen';
	import DemoRestrictionOverlay from '$lib/components/DemoRestrictionOverlay.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import DataTable from '$lib/components/table/DataTable.svelte';
	import FacetedFilter from '$lib/components/table/FacetedFilter.svelte';
	import {
		type DataTableFeatures,
		dataTableFeatures,
		matchesSelection,
		NO_PAGINATION,
		sortableText
	} from '$lib/components/table/features';
	import { mainSidebarItems } from '$lib/config/sidebar';
	import { toastApiError } from '$lib/utils/toast';

	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let isDemo = $derived(page.data.user?.scope === 'demo');

	let experiments = $derived(data.experiments);
	let folders = $derived(data.folders);

	let isExperimentModalOpen = $state(false);
	let isDeleteModalOpen = $state(false);
	let isQRModalOpen = $state(false);

	let selectedExperiment = $state<ExperimentPublic | null>(null);
	let qrCode = $state<Blob | null>(null);
	let qrCodeUrl = $state<string | null>(null);
	let openDropdownId = $state<string | null>(null);
	let dropdownPosition = $state<{ top: number; left: number } | null>(null);

	// Create/Edit Form State
	/** The experiment being edited; null while creating one. */
	let editingExperiment = $state<ExperimentPublic | null>(null);
	let newExperimentTitle = $state('');
	let allocation = $state<ExperimentAllocation>('random');
	let selectedProjectIds = $state<string[]>([]);
	let projectWeights = $state<Record<string, number>>({});
	/** Completed interviews wanted per project; empty for no limit. */
	let projectTargets = $state<Record<string, number | null>>({});
	let projectExperimentOnly = $state<Record<string, boolean>>({});

	const ALLOCATIONS: { value: ExperimentAllocation; label: string; description: string }[] = [
		{
			value: 'random',
			label: 'Random',
			description: 'Each respondent is drawn by the weights.'
		},
		{
			value: 'balanced',
			label: 'Balanced',
			description: 'Each respondent goes to the project furthest below its share of assignments.'
		},
		{
			value: 'balanced_completed',
			label: 'Balanced on completed interviews',
			description:
				'Each respondent goes to the project furthest below its share of completed interviews. This steers respondents towards projects people drop out of, which can bias the comparison.'
		}
	];

	const ALLOCATION_LABELS: Record<ExperimentAllocation, string> = {
		random: 'Random',
		balanced: 'Balanced',
		balanced_completed: 'Balanced (completed)'
	};

	/** Every project the reader can see, for titles and settings by id. */
	const projectsById = $derived(
		new Map<string, ProjectPublic>(
			folders.flatMap((folder) => folder.projects.map((project) => [project.id, project]))
		)
	);

	/** The edited experiment's projects, by id. */
	const editingArms = $derived(
		new Map((editingExperiment?.projects ?? []).map((arm) => [arm.project_id, arm]))
	);

	/**
	 * A project respondents were already given cannot be removed: the API
	 * refuses, as their assignments would no longer count.
	 */
	function isLocked(projectId: string): boolean {
		const arm = editingArms.get(projectId);
		return !!arm && ((arm.assigned ?? 0) > 0 || (arm.completed ?? 0) > 0);
	}

	// Delete Form State
	let deleteConfirmationText = $state('');
	let clearExperimentOnly = $state(true);

	/** The experiment's projects that take respondents only through experiments. */
	const restrictedProjects = $derived(
		(selectedExperiment?.projects ?? [])
			.map((arm) => projectsById.get(arm.project_id))
			.filter((project) => project?.experiment_only)
	);

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

	/**
	 * The menu is placed from a one-off measurement of its trigger, so it cannot
	 * follow it. Capture phase, because a scroll inside the table's own row area
	 * does not bubble.
	 */
	$effect(() => {
		const close = () => {
			openDropdownId = null;
			dropdownPosition = null;
		};
		window.addEventListener('scroll', close, true);
		return () => window.removeEventListener('scroll', close, true);
	});

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
		editingExperiment = null;
		newExperimentTitle = '';
		allocation = 'random';
		selectedProjectIds = [];
		projectWeights = {};
		projectTargets = {};
		projectExperimentOnly = {};
		isExperimentModalOpen = true;
	}

	function openEditModal(experiment: ExperimentPublic) {
		// Projects the reader cannot see are not in the form; `experimentBody`
		// sends them back unchanged.
		const arms = (experiment.projects ?? []).filter((arm) => projectsById.has(arm.project_id));
		editingExperiment = experiment;
		newExperimentTitle = experiment.title;
		allocation = experiment.allocation ?? 'random';
		selectedProjectIds = arms.map((arm) => arm.project_id);
		projectWeights = Object.fromEntries(arms.map((arm) => [arm.project_id, arm.weight ?? 1]));
		projectTargets = Object.fromEntries(arms.map((arm) => [arm.project_id, arm.target ?? null]));
		projectExperimentOnly = Object.fromEntries(
			arms.map((arm) => [
				arm.project_id,
				projectsById.get(arm.project_id)?.experiment_only ?? false
			])
		);
		isExperimentModalOpen = true;
	}

	function openDeleteModal(experiment: ExperimentPublic) {
		selectedExperiment = experiment;
		deleteConfirmationText = '';
		clearExperimentOnly = true;
		isDeleteModalOpen = true;
	}

	/** Show `blob` as the QR code, releasing the URL of the one before. */
	function showQrCode(blob: Blob | null) {
		if (qrCodeUrl) URL.revokeObjectURL(qrCodeUrl);
		qrCode = blob;
		qrCodeUrl = blob && URL.createObjectURL(blob);
	}

	async function openQRModal(experiment: ExperimentPublic) {
		selectedExperiment = experiment;
		showQrCode(null);

		const { data, error } = await Experiments.generateExperimentQr({
			path: { experiment_id: experiment.id },
			parseAs: 'blob'
		});
		if (error || !data) {
			toastApiError(error, 'Failed to load the QR code');
			return;
		}
		showQrCode(data);
		isQRModalOpen = true;
	}

	async function copyQrCode() {
		if (!qrCode) return;
		try {
			await navigator.clipboard.write([new ClipboardItem({ 'image/png': qrCode })]);
			toast.success('QR code copied to clipboard');
		} catch (e) {
			// Clipboard access can be refused outright.
			console.error(e);
			toast.error('Failed to copy the QR code');
		}
	}

	function experimentBody(): ExperimentCreate {
		const projects: ExperimentProjectCreate[] = selectedProjectIds.map((project_id) => {
			const experimentOnly = projectExperimentOnly[project_id] ?? false;
			return {
				project_id,
				weight: projectWeights[project_id] || 0,
				target: projectTargets[project_id] || null,
				// Sent only when changed: it is the project's own setting, which
				// the API asks for the editor role to change.
				experiment_only:
					experimentOnly !== (projectsById.get(project_id)?.experiment_only ?? false)
						? experimentOnly
						: null
			};
		});
		for (const [project_id, arm] of editingArms) {
			if (!projectsById.has(project_id)) {
				projects.push({ project_id, weight: arm.weight, target: arm.target });
			}
		}
		return { title: newExperimentTitle, allocation, projects };
	}

	async function handleSave() {
		const { data, error } = editingExperiment
			? await Experiments.updateExperiment({
					path: { experiment_id: editingExperiment.id },
					body: experimentBody()
				})
			: await Experiments.createExperiment({ body: experimentBody() });

		if (error) {
			toastApiError(
				error,
				editingExperiment ? 'Failed to update experiment' : 'Failed to create experiment'
			);
			return;
		}

		if (data) {
			await invalidateAll();
			isExperimentModalOpen = false;
		}
	}

	async function handleDelete() {
		if (!selectedExperiment) return;

		const { error } = await Experiments.deleteExperiment({
			path: { experiment_id: selectedExperiment.id },
			query: { clear_experiment_only: restrictedProjects.length > 0 && clearExperimentOnly }
		});
		if (error) {
			toastApiError(error, 'Failed to delete experiment');
			return;
		}
		await invalidateAll();
		isDeleteModalOpen = false;
		selectedExperiment = null;
	}

	function copyLink(experiment: ExperimentPublic) {
		const url = `${window.location.origin}/interview/redirect?id=${experiment.id}`;
		navigator.clipboard.writeText(url);
		toast.success('Link copied to clipboard');
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

	/**
	 * Whether the reader may put this folder's projects in an experiment: the
	 * API asks for the editor role on each, and platform admins pass every
	 * role check. Only to disable the choice -- the API checks for itself.
	 */
	function canLink(folder: FolderWithProjectsPublic): boolean {
		const user = page.data.user;
		if (!user) return false;
		if (user.scope === 'admin') return true;
		return (folder.collaborators ?? []).some(
			(collaborator) =>
				collaborator.user.id === user.id &&
				(collaborator.role === 'editor' || collaborator.role === 'admin')
		);
	}

	function handleCheckboxChange(project: ProjectPublic, event: Event) {
		const checked = (event.target as HTMLInputElement).checked;
		if (checked) {
			projectWeights[project.id] = 1;
			projectTargets[project.id] = null;
			projectExperimentOnly[project.id] = project.experiment_only ?? false;
		} else {
			delete projectWeights[project.id];
			delete projectTargets[project.id];
			delete projectExperimentOnly[project.id];
		}
	}

	/* ---------------------------------------------------------------- table */

	const helper = createColumnHelper<DataTableFeatures, ExperimentPublic>();

	const columns = helper.columns([
		helper.display({ id: 'icon', enableHiding: false, meta: { class: 'w-10 text-gray-400' } }),
		helper.accessor((e) => sortableText(e.title || e.id), {
			id: 'title',
			header: 'Experiment',
			sortFn: 'text',
			sortUndefined: 'last',
			meta: { class: 'font-medium whitespace-nowrap text-dark' }
		}),
		helper.accessor('status', {
			header: 'Status',
			sortFn: 'text',
			filterFn: matchesSelection
		}),
		helper.accessor((e) => e.allocation ?? 'random', {
			id: 'allocation',
			header: 'Allocation',
			sortFn: 'text',
			meta: { class: 'whitespace-nowrap text-gray-600' }
		}),
		helper.display({
			id: 'projects',
			header: 'Projects',
			meta: { class: 'tabular-nums text-gray-600' }
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
			return experiments;
		},
		getRowId: (e) => e.id,
		globalFilterFn: 'includesString',
		getColumnCanGlobalFilter: (column) => column.id === 'title',
		initialState: { pagination: NO_PAGINATION, sorting: [{ id: 'title', desc: false }] }
	});

	const columnLabels: Record<string, string> = {
		title: 'Experiment',
		status: 'Status',
		allocation: 'Allocation',
		projects: 'Projects'
	};
</script>

<svelte:window onclick={handleWindowClick} />

<Sidebar items={mainSidebarItems} />
{#if isDemo}
	<DemoRestrictionOverlay
		title="Experiments unavailable"
		description="You cannot access experiments with your current demo access."
	/>
{/if}

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

<DataTable
	{table}
	{columnLabels}
	selectable={false}
	search
	rowLabel="experiment"
	searchPlaceholder="Search experiments..."
	emptyTitle="No experiments yet"
	emptyDescription="Create one to get started."
>
	{#snippet filters()}
		{#if table.getColumn('status')}
			<FacetedFilter title="Status" column={table.getColumn('status')!} />
		{/if}
	{/snippet}

	{#snippet cell(columnId, row)}
		{@const experiment = row.original}
		{#if columnId === 'icon'}
			<i class="fa-solid fa-vial"></i>
		{:else if columnId === 'title'}
			{experiment.title || experiment.id}
		{:else if columnId === 'status'}
			<!-- The schema's default, which the type leaves optional. -->
			{@const status = experiment.status ?? 'active'}
			<span class="rounded-full border px-3 py-1 text-xs font-semibold {getStatusClass(status)}">
				{status}
			</span>
		{:else if columnId === 'allocation'}
			{ALLOCATION_LABELS[experiment.allocation ?? 'random']}
		{:else if columnId === 'projects'}
			<ul class="space-y-0.5 text-xs">
				{#each experiment.projects ?? [] as arm (arm.id)}
					<li class="flex flex-wrap gap-x-2">
						<span class="font-medium text-dark">
							{projectsById.get(arm.project_id)?.title ?? 'Project'}
						</span>
						<span title="Weight">&times;{(arm.weight ?? 1).toFixed(2)}</span>
						<span title="Respondents given this project">{arm.assigned ?? 0} assigned</span>
						<span title="Completed interviews">
							{arm.completed ?? 0}{arm.target ? ` / ${arm.target}` : ''} completed
						</span>
					</li>
				{/each}
			</ul>
		{:else if columnId === 'actions'}
			<button
				class="dropdown-trigger rounded-full p-1.5 text-gray-400 hover:bg-secondary/40 hover:text-dark"
				onclick={(e) => {
					e.stopPropagation();
					toggleDropdown(experiment.id, e);
				}}
				aria-label="Experiment options"
			>
				<i class="fa-solid fa-ellipsis-vertical"></i>
			</button>
		{/if}
	{/snippet}
</DataTable>

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
					openEditModal(experiment);
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

<!-- Create/Edit Modal -->
{#if isExperimentModalOpen}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
		transition:fade={{ duration: 150 }}
	>
		<div class="w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-xl">
			<div class="flex items-center justify-between border-b border-gray-100 p-6">
				<h2 class="text-xl font-semibold text-gray-800">
					{editingExperiment ? 'Edit Experiment' : 'Create New Experiment'}
				</h2>
				<button
					class="text-gray-400 hover:text-gray-600"
					onclick={() => (isExperimentModalOpen = false)}
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
				<fieldset>
					<legend class="mb-1 block text-sm font-medium text-gray-700">Allocation</legend>
					<div class="space-y-2">
						{#each ALLOCATIONS as option (option.value)}
							<label class="flex cursor-pointer items-start gap-2 text-sm text-gray-700">
								<input
									type="radio"
									name="allocation"
									value={option.value}
									bind:group={allocation}
									class="mt-0.5 border-gray-300 text-primary focus:ring-primary"
								/>
								<span>
									<span class="font-medium">{option.label}</span>
									<span class="block text-xs text-gray-500">{option.description}</span>
								</span>
							</label>
						{/each}
					</div>
				</fieldset>
				<fieldset class="rounded-md border border-gray-200 p-4">
					<legend class="px-2 text-sm font-medium text-gray-700">Projects</legend>
					<div class="max-h-[40vh] space-y-4 overflow-y-auto">
						{#each folders as folder (folder.id)}
							{#if folder.projects.length > 0}
								{@const linkable = canLink(folder)}
								<div>
									<h3 class="mb-2 text-xs font-semibold text-gray-500 uppercase">
										{folder.title}
										{#if !linkable}
											<span class="ml-1 font-normal normal-case">
												&middot; needs editor access
											</span>
										{/if}
									</h3>
									<div class="space-y-2 pl-2">
										{#each folder.projects as project (project.id)}
											<!-- A linked project stays removable without the role: it only
											     takes owning the experiment. -->
											{@const locked = isLocked(project.id)}
											{@const selectable = !locked && (linkable || editingArms.has(project.id))}
											<div>
												<label
													class="flex items-center gap-2 text-sm {selectable
														? 'cursor-pointer text-gray-700'
														: 'cursor-not-allowed text-gray-400'}"
													title={locked
														? 'Respondents were already given this project, so it cannot be removed. Set its weight to 0 to stop sending new ones.'
														: selectable
															? undefined
															: 'You need the editor role in this folder to add its projects to an experiment'}
												>
													<input
														type="checkbox"
														value={project.id}
														bind:group={selectedProjectIds}
														onchange={(e) => handleCheckboxChange(project, e)}
														disabled={!selectable}
														class="rounded border-gray-300 text-primary focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
													/>
													{project.title}
												</label>
												{#if selectedProjectIds.includes(project.id)}
													<div
														class="mt-1 mb-2 ml-6 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500"
														transition:fade
													>
														<label class="flex items-center gap-1.5">
															Weight
															<input
																type="number"
																bind:value={projectWeights[project.id]}
																min="0"
																step="0.01"
																class="h-7 w-20 rounded-md border-gray-300 text-xs focus:border-primary focus:ring-primary"
															/>
														</label>
														<label
															class="flex items-center gap-1.5"
															title="Completed interviews wanted. Once reached, the project takes no new respondents."
														>
															Target
															<input
																type="number"
																bind:value={projectTargets[project.id]}
																min="1"
																step="1"
																placeholder="none"
																class="h-7 w-20 rounded-md border-gray-300 text-xs focus:border-primary focus:ring-primary"
															/>
														</label>
														<label
															class="flex items-center gap-1.5 {linkable
																? 'cursor-pointer'
																: 'cursor-not-allowed opacity-50'}"
															title={linkable
																? 'A project setting: its own link stops taking respondents, so only experiments can send them there.'
																: 'You need the editor role in this folder to change this project setting'}
														>
															<input
																type="checkbox"
																bind:checked={projectExperimentOnly[project.id]}
																disabled={!linkable}
																class="rounded border-gray-300 text-primary focus:ring-primary"
															/>
															Only through experiments
														</label>
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
					onclick={() => (isExperimentModalOpen = false)}
				>
					Cancel
				</button>
				<button
					class="hover:bg-opacity-90 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
					onclick={handleSave}
					disabled={!newExperimentTitle || selectedProjectIds.length === 0}
				>
					{editingExperiment ? 'Save' : 'Create'}
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
				{#if restrictedProjects.length > 0}
					<label class="flex cursor-pointer items-start gap-2 text-sm text-gray-700">
						<input
							type="checkbox"
							bind:checked={clearExperimentOnly}
							class="mt-0.5 rounded border-gray-300 text-primary focus:ring-primary"
						/>
						<span>
							Let its projects take respondents from their own links again
							<span class="block text-xs text-gray-500">
								{restrictedProjects.map((project) => project?.title).join(', ')}
								{restrictedProjects.length === 1 ? 'only takes' : 'only take'} respondents through experiments.
								Projects another experiment still uses are left as they are.
							</span>
						</span>
					</label>
				{/if}
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
					onclick={copyQrCode}
					disabled={!qrCode}
				>
					Copy
				</button>
			</div>
		</div>
	</div>
{/if}
