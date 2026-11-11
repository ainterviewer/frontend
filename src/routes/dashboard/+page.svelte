<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { toast } from 'svelte-sonner';

	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { FolderWithProjectsPublic, ProjectLanguage, ProjectPublic } from '$lib/api';
	import { Folders, Projects } from '$lib/api';
	import Select from '$lib/components/Select.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import { mainSidebarItems } from '$lib/config/sidebar';
	import { formatDate, formatDay } from '$lib/utils/datetime';
	import { toastApiError } from '$lib/utils/toast';

	import type { PageData } from './$types';
	import CollaboratorsModal from './CollaboratorsModal.svelte';
	import ConfirmDeleteModal from './ConfirmDeleteModal.svelte';
	import CreateFolderModal from './CreateFolderModal.svelte';
	import CreateProjectModal from './CreateProjectModal.svelte';
	import { startDashboardTour } from './dashboardTour';
	import {
		type DashboardView,
		NATURAL_DIRECTION,
		saveView,
		SORT_LABELS,
		type SortKey,
		sortProjects
	} from './dashboardView';
	import { canArchive, isCollaborator } from './folderAccess';
	import LeaveFolderModal from './LeaveFolderModal.svelte';
	import MoveProjectModal from './MoveProjectModal.svelte';
	import RenameFolderModal from './RenameFolderModal.svelte';

	let { data }: { data: PageData } = $props();

	// Projects whose move has been requested but not yet confirmed by the server,
	// as projectId -> target folderId. Applied on top of the loaded data so a
	// dropped card lands in its new folder immediately.
	let pendingMoves: Record<string, string> = $state({});

	let folders = $derived.by(() => {
		const loaded = data.folders ?? [];
		if (Object.keys(pendingMoves).length === 0) return loaded;

		const movedProjects = loaded
			.flatMap((folder) => folder.projects)
			.filter((project) => pendingMoves[project.id]);

		return loaded.map((folder) => ({
			...folder,
			projects: [
				...folder.projects.filter((project) => !pendingMoves[project.id]),
				...movedProjects.filter((project) => pendingMoves[project.id] === folder.id)
			]
		}));
	});
	let languages = $derived(data.languages ?? []);

	// The cookie's view on the first paint, this page's own from then on: a
	// change is saved straight to the cookie, so there is nothing to reload.
	let view = $state<DashboardView>(untrack(() => data.view));

	function setView(next: Partial<DashboardView>) {
		view = { ...view, ...next };
		saveView(view);
	}

	function setSort(sort: SortKey) {
		// A new key starts in the direction it reads naturally.
		if (sort !== view.sort) setView({ sort, direction: NATURAL_DIRECTION[sort] });
	}

	const sortItems = Object.entries(SORT_LABELS).map(([value, label]) => ({ value, label }));

	/**
	 * What the page lists: archived folders and projects left out unless asked
	 * for, and each folder's projects in the chosen order. A project in an
	 * archived folder goes with its folder, so it is not counted twice.
	 */
	let visibleFolders = $derived(
		folders
			.filter((folder) => view.showArchived || !folder.archived_at)
			.map((folder) => ({
				...folder,
				projects: sortProjects(
					folder.projects.filter((project) => view.showArchived || !project.archived_at),
					view
				)
			}))
	);

	let archivedCount = $derived(
		folders.reduce(
			(count, folder) =>
				count +
				(folder.archived_at ? 1 : folder.projects.filter((project) => project.archived_at).length),
			0
		)
	);

	/**
	 * The dialog that is open, if any, and what it acts on. Each dialog keeps
	 * its own form state, and is mounted afresh every time it opens.
	 */
	type Dialog =
		| { kind: 'create-folder' }
		| {
				kind: 'rename-folder' | 'collaborators' | 'leave-folder' | 'delete-folder';
				folder: FolderWithProjectsPublic;
		  }
		| { kind: 'create-project'; folder: FolderWithProjectsPublic }
		| { kind: 'move-project'; project: ProjectPublic; folderId: string }
		| { kind: 'delete-project'; project: ProjectPublic };
	let dialog = $state.raw<Dialog | null>(null);

	function openDialog(next: Dialog) {
		dialog = next;
		activeDropdown = null;
	}

	function closeDialog() {
		dialog = null;
	}

	// UI State
	let activeDropdown: string | null = $state(null);

	// Drag & Drop
	let draggedProject: { id: string; folderId: string } | null = $state(null);
	let dragOverFolderId: string | null = $state(null);

	onMount(() => {
		// The whole tour on a first visit, then only steps added since; nothing
		// if the user opted out of all tours.
		startDashboardTour(!!page.data.user?.with_preview_features);

		// Close dropdowns when clicking outside
		const handleClickOutside = (e: MouseEvent) => {
			if (activeDropdown && !(e.target as Element).closest('.dropdown-container')) {
				activeDropdown = null;
			}
		};
		window.addEventListener('click', handleClickOutside);
		return () => window.removeEventListener('click', handleClickOutside);
	});

	async function setFolderArchived(folder: FolderWithProjectsPublic, archived: boolean) {
		activeDropdown = null;
		const { error } = await Folders.setFolderArchived({
			path: { folder_id: folder.id },
			body: { archived }
		});
		if (error) {
			toastApiError(error, archived ? 'Failed to archive folder' : 'Failed to unarchive folder');
			return;
		}
		await invalidateAll();
		toast.success(
			archived && !view.showArchived
				? `Archived "${folder.title}". Show archived to find it again.`
				: `${archived ? 'Archived' : 'Unarchived'} "${folder.title}"`
		);
	}

	async function setProjectArchived(project: ProjectPublic, archived: boolean) {
		activeDropdown = null;
		const { error } = await Projects.setProjectArchived({
			path: { project_id: project.id },
			body: { archived }
		});
		if (error) {
			toastApiError(error, archived ? 'Failed to archive project' : 'Failed to unarchive project');
			return;
		}
		await invalidateAll();
		toast.success(
			archived && !view.showArchived
				? `Archived "${project.title}". Show archived to find it again.`
				: `${archived ? 'Archived' : 'Unarchived'} "${project.title}"`
		);
	}

	async function handleCloneProject(project: ProjectPublic) {
		const { error } = await Projects.cloneProject({
			path: { project_id: project.id }
		});
		if (error) {
			toastApiError(error, 'Failed to clone project');
			return;
		}
		activeDropdown = null;
		await invalidateAll();
	}

	async function moveProject(projectId: string, sourceFolderId: string, targetFolderId: string) {
		if (sourceFolderId === targetFolderId) return;

		const targetTitle = folders.find((f) => f.id === targetFolderId)?.title ?? 'folder';
		pendingMoves = { ...pendingMoves, [projectId]: targetFolderId };

		const { error } = await Projects.moveProject({
			path: { project_id: projectId },
			body: { folder_id: targetFolderId }
		});

		const { [projectId]: _moved, ...remaining } = pendingMoves;

		if (error) {
			// Drop the optimistic move so the card snaps back to its old folder.
			pendingMoves = remaining;
			toastApiError(error, 'Failed to move project');
			return;
		}

		await invalidateAll();
		pendingMoves = remaining;
		toast.success(`Moved project to "${targetTitle}"`);
	}

	async function handleMoveProject(project: ProjectPublic, source: string, target: string) {
		closeDialog();
		await moveProject(project.id, source, target);
	}

	function handleDragStart(e: DragEvent, projectId: string, folderId: string) {
		draggedProject = { id: projectId, folderId };
		activeDropdown = null;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', projectId);
		}
	}

	function handleDragEnd() {
		draggedProject = null;
		dragOverFolderId = null;
	}

	function handleDragOver(e: DragEvent, folderId: string) {
		if (!draggedProject || draggedProject.folderId === folderId) return;
		// Only preventDefault on a valid target, so invalid folders show a "no drop" cursor.
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
		dragOverFolderId = folderId;
	}

	function handleDragLeave(e: DragEvent, folderId: string) {
		// dragleave also fires when moving between children of the drop zone.
		const related = e.relatedTarget as Node | null;
		if (related && (e.currentTarget as HTMLElement).contains(related)) return;
		if (dragOverFolderId === folderId) dragOverFolderId = null;
	}

	async function handleDrop(e: DragEvent, folderId: string) {
		e.preventDefault();
		const dropped = draggedProject;
		draggedProject = null;
		dragOverFolderId = null;
		if (!dropped || dropped.folderId === folderId) return;
		await moveProject(dropped.id, dropped.folderId, folderId);
	}

	/** The language whose localization a project's per-language routes should open. */
	function defaultLanguageOf(project: { available_languages?: ProjectLanguage[] | null }): string {
		const languages = project.available_languages ?? [];
		return (languages.find((l) => l.is_default) ?? languages[0])?.code ?? 'EN';
	}

	function handleRowClick(projectId: string, defaultLanguage: string) {
		// Mock navigation or real navigation if route exists
		// document.cookie = `project_id=${projectId}; path=/`; // Old app did this
		goto(resolve(`/dashboard/projects/${projectId}/${defaultLanguage}/setup`));
	}

	function toggleDropdown(e: MouseEvent, projectId: string) {
		e.stopPropagation();
		activeDropdown = activeDropdown === projectId ? null : projectId;
	}

	function getStatusColor(status: string | undefined) {
		switch (status) {
			case 'active':
				return 'text-primary';
			case 'inactive':
				return 'text-red-600';
		}
	}
</script>

<Sidebar items={mainSidebarItems} />
<h1 class="page-title mb-8 text-5xl">
	Welcome to <span
		class="bg-linear-to-r from-dark to-primary bg-clip-text font-['Noto_Sans_Variable'] font-semibold text-transparent"
		>AInterviewer</span
	>
</h1>

<p class="mb-8 text-gray-600">
	On this page you can create and manage folders and projects.
	<!-- FIXME:  -->
	<!-- When you create a folder you can choose other users you want to collaborate with. The users your -->
	<!-- choose wil be able to access all projects in the folder. -->
</p>

<div class="flex flex-wrap items-center justify-between gap-3">
	<h2 class="page-title">Folders</h2>
	<div class="ml-auto flex flex-wrap items-center justify-end gap-2">
		<!-- One tour target for the two: they are one step, how the list is shown. -->
		<div data-tour="organize-projects" class="flex flex-wrap items-center gap-2">
			<!-- One pill for the order: the key opens a menu, the arrow beside it
			     flips the direction. Same height and rounding as New Folder, so the
			     bar reads as a row of controls rather than a form. -->
			<div
				class="flex h-10 items-center rounded-full border border-gray-200 bg-white text-sm text-gray-600 shadow-xs"
			>
				<Select
					class="flex h-full cursor-pointer items-center gap-2 rounded-l-full pr-3 pl-4 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:outline-none"
					aria-label="Sort projects by"
					items={sortItems}
					bind:value={() => view.sort, (value) => setSort(value as SortKey)}
				>
					{#snippet trigger(label)}
						<span class="text-gray-400">Sort</span>
						<span class="font-medium whitespace-nowrap text-gray-800">{label}</span>
						<i class="fa-solid fa-chevron-down text-[0.6rem] text-gray-400"></i>
					{/snippet}
				</Select>
				<span aria-hidden="true" class="h-5 w-px bg-gray-200"></span>
				<button
					type="button"
					class="flex h-full w-10 cursor-pointer items-center justify-center rounded-r-full text-gray-500 hover:bg-gray-50 hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:outline-none"
					onclick={() => setView({ direction: view.direction === 'asc' ? 'desc' : 'asc' })}
					title={view.sort === 'name'
						? view.direction === 'asc'
							? 'A to Z'
							: 'Z to A'
						: view.direction === 'asc'
							? 'Oldest first'
							: 'Newest first'}
					aria-label="Reverse the order"
				>
					<i
						class={[
							'fa-solid',
							view.sort === 'name'
								? view.direction === 'asc'
									? 'fa-arrow-down-a-z'
									: 'fa-arrow-down-z-a'
								: view.direction === 'asc'
									? 'fa-arrow-up-wide-short'
									: 'fa-arrow-down-wide-short'
						]}
					></i>
				</button>
			</div>
			<button
				type="button"
				aria-pressed={view.showArchived}
				class={[
					'flex h-10 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm shadow-xs transition-colors focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:outline-none',
					view.showArchived
						? 'border-primary/30 bg-primary/10 text-primary'
						: 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
				]}
				onclick={() => setView({ showArchived: !view.showArchived })}
				title={view.showArchived
					? 'Hide archived folders and projects'
					: 'Show archived folders and projects'}
			>
				<i class="fa-solid fa-box-archive"></i>
				Archived
				{#if archivedCount > 0}
					<span
						class={[
							'flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs leading-none font-semibold tabular-nums',
							view.showArchived ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'
						]}
					>
						{archivedCount}
					</span>
				{/if}
			</button>
		</div>
		<button
			data-tour="new-folder"
			class="flex h-10 items-center rounded-full border-none bg-secondary px-4 text-sm font-medium text-dark hover:brightness-95"
			onclick={() => openDialog({ kind: 'create-folder' })}
			title="Create new folder"
			aria-label="Create new folder"
		>
			<i class="fa-solid fa-folder-plus pr-2 text-base"></i>
			New Folder
		</button>
	</div>
</div>

{#each visibleFolders as folder, folderIndex (folder.id)}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="rounded-lg transition-colors {dragOverFolderId === folder.id
			? 'bg-primary/5 outline-2 outline-offset-4 outline-primary outline-dashed'
			: ''}"
		ondragover={(e) => handleDragOver(e, folder.id)}
		ondragleave={(e) => handleDragLeave(e, folder.id)}
		ondrop={(e) => handleDrop(e, folder.id)}
	>
		<div class="relative mt-4 mb-2 flex items-center gap-2 border-t-2 border-primary pt-6">
			<i
				class={[
					'fa-solid text-4xl',
					folder.archived_at ? 'fa-box-archive text-gray-400' : 'fa-folder text-primary'
				]}
			></i>
			<h2 class={['text-lg', folder.archived_at && 'text-gray-500']}>{folder.title}</h2>
			{#if folder.archived_at}
				<span
					class="rounded-full bg-gray-200 px-2 py-0.5 text-[0.65rem] font-semibold tracking-wide text-gray-600 uppercase"
					title={`Archived ${formatDate(folder.archived_at)}`}
				>
					Archived
				</span>
			{/if}
			<div class="dropdown-container relative">
				<button
					data-tour={folderIndex === 0 ? 'folder-menu' : undefined}
					class="rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
					onclick={(e) => toggleDropdown(e, folder.id)}
					aria-label="Folder actions"
				>
					<i class="fa-solid fa-ellipsis-vertical"></i>
				</button>
				{#if activeDropdown === folder.id}
					<div class="absolute left-0 z-10 mt-2 w-52 rounded-md bg-white py-1 shadow-lg">
						<button
							class="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
							onclick={() => openDialog({ kind: 'rename-folder', folder })}
						>
							Rename
						</button>
						<button
							class="flex w-full items-center justify-between px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
							onclick={() => openDialog({ kind: 'collaborators', folder })}
						>
							Collaborators
							<span
								class="flex h-5 min-w-5 items-center justify-center rounded-full bg-gray-100 px-1 text-xs leading-none font-semibold text-gray-500 tabular-nums"
							>
								{folder.collaborators?.length ?? 0}
							</span>
						</button>
						{#if canArchive(folder, page.data.user)}
							<button
								class="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
								onclick={() => setFolderArchived(folder, !folder.archived_at)}
							>
								{folder.archived_at ? 'Unarchive' : 'Archive'}
							</button>
						{/if}
						{#if isCollaborator(folder, page.data.user)}
							<button
								class="block w-full px-4 py-2 text-left text-sm text-red-700 hover:bg-red-50"
								onclick={() => openDialog({ kind: 'leave-folder', folder })}
							>
								Leave
							</button>
						{/if}
						<button
							class="block w-full px-4 py-2 text-left text-sm text-red-700 hover:bg-red-50"
							onclick={() => openDialog({ kind: 'delete-folder', folder })}
						>
							Delete
						</button>
					</div>
				{/if}
			</div>
		</div>
		<!-- An archived folder's projects are faded with it, not tagged one by one.
		     The fade goes on what a card shows, never on the grid or the card: an
		     opacity below 1 makes its own stacking context, which would trap the
		     card's menu underneath the next folder. -->
		<div class="mb-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
			{#each folder.projects as project (project.id)}
				{@const faded = !!(folder.archived_at || project.archived_at)}
				<div
					class="flex min-h-[190px] cursor-grab flex-col rounded-lg bg-white shadow-md transition-shadow hover:shadow-xl {activeDropdown !==
					project.id
						? 'hover:scale-101'
						: ''} {draggedProject?.id === project.id ? 'opacity-40' : ''}"
					role="button"
					tabindex="0"
					draggable="true"
					ondragstart={(e) => handleDragStart(e, project.id, folder.id)}
					ondragend={handleDragEnd}
					onclick={() => handleRowClick(project.id, defaultLanguageOf(project))}
					onkeydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							handleRowClick(project.id, defaultLanguageOf(project));
						}
					}}
				>
					<div class={['flex grow flex-col p-4', faded && 'opacity-60']}>
						<div class="flex">
							<h3 class="mb-1 w-full text-lg leading-snug font-semibold">
								{project.title}
								{#if project.archived_at}
									<span
										class="ml-1 rounded-full bg-gray-200 px-2 py-0.5 align-middle text-[0.65rem] font-semibold tracking-wide text-gray-600 uppercase"
										title={`Archived ${formatDate(project.archived_at)}`}
									>
										Archived
									</span>
								{/if}
							</h3>
							<i class="fas fa-clipboard-list ml-1 text-xl"></i>
						</div>

						<div class="mt-auto flex flex-col gap-1 text-sm text-gray-500">
							<p>
								Created: {formatDay(project.created_at)}
							</p>
							<p>
								Updated: {project.last_updated ? formatDate(project.last_updated) : 'N/A'}
							</p>
							<p>
								Respondents: {project.n_interviews}
							</p>
						</div>
					</div>
					<div class="flex items-center justify-between border-t border-gray-200 px-4 py-2">
						<p class={['text-sm text-gray-500', faded && 'opacity-60']}>
							Status: <span class="{getStatusColor(project.status)} font-medium"
								>{project.status || 'N/A'}</span
							>
						</p>
						<div class="dropdown-container relative">
							<button
								class="rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
								onclick={(e) => toggleDropdown(e, project.id)}
								aria-label="Project actions"
							>
								<i class="fa-solid fa-ellipsis-vertical"></i>
							</button>
							{#if activeDropdown === project.id}
								<div class="absolute right-0 z-10 mt-2 w-48 rounded-md bg-white py-1 shadow-lg">
									<button
										class="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
										onclick={(e) => {
											e.stopPropagation();
											handleCloneProject(project);
										}}
									>
										Clone
									</button>
									{#if visibleFolders.length > 1}
										<button
											class="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
											onclick={(e) => {
												e.stopPropagation();
												openDialog({ kind: 'move-project', project, folderId: folder.id });
											}}
										>
											Move to folder
										</button>
									{/if}
									<a
										class="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
										href={resolve(
											`/dashboard/projects/${project.id}/${defaultLanguageOf(project)}/settings`
										)}
									>
										Settings
									</a>
									{#if canArchive(folder, page.data.user)}
										<button
											class="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
											onclick={(e) => {
												e.stopPropagation();
												setProjectArchived(project, !project.archived_at);
											}}
										>
											{project.archived_at ? 'Unarchive' : 'Archive'}
										</button>
									{/if}
									<button
										class="block w-full px-4 py-2 text-left text-sm text-red-700 hover:bg-red-50"
										onclick={(e) => {
											e.stopPropagation();
											openDialog({ kind: 'delete-project', project });
										}}
									>
										Delete
									</button>
								</div>
							{/if}
						</div>
					</div>
				</div>
			{/each}

			<div
				data-tour={folderIndex === 0 ? 'new-project' : undefined}
				class={[
					'flex min-h-[190px] items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-4 text-gray-500 transition-colors hover:border-primary hover:text-primary',
					folder.archived_at && 'opacity-60'
				]}
				role="button"
				tabindex="0"
				onclick={() => openDialog({ kind: 'create-project', folder })}
				onkeydown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						openDialog({ kind: 'create-project', folder });
					}
				}}
			>
				<i class="fa-solid fa-plus mr-2 text-xl"></i>
				New Project
			</div>
		</div>
	</div>
{/each}
{#if folders.length === 0}
	<div class="p-8 text-center text-gray-500">No folders found. Create one to get started!</div>
{:else if visibleFolders.length === 0}
	<div class="p-8 text-center text-gray-500">
		All your folders are archived.
		<button
			type="button"
			class="cursor-pointer text-primary underline underline-offset-2 hover:no-underline"
			onclick={() => setView({ showArchived: true })}
		>
			Show archived
		</button>
	</div>
{/if}

{#if dialog?.kind === 'create-folder'}
	<CreateFolderModal onClose={closeDialog} />
{:else if dialog?.kind === 'rename-folder'}
	<RenameFolderModal folder={dialog.folder} onClose={closeDialog} />
{:else if dialog?.kind === 'collaborators'}
	<CollaboratorsModal folder={dialog.folder} onClose={closeDialog} />
{:else if dialog?.kind === 'leave-folder'}
	<LeaveFolderModal folder={dialog.folder} onClose={closeDialog} />
{:else if dialog?.kind === 'delete-folder'}
	{@const folder = dialog.folder}
	<ConfirmDeleteModal
		noun="folder"
		name={folder.title}
		remove={() => Folders.deleteFolder({ path: { folder_id: folder.id } })}
		onClose={closeDialog}
	/>
{:else if dialog?.kind === 'create-project'}
	<CreateProjectModal
		folderId={dialog.folder.id}
		folderTitle={dialog.folder.title}
		{languages}
		onClose={closeDialog}
	/>
{:else if dialog?.kind === 'move-project'}
	{@const { project, folderId } = dialog}
	<MoveProjectModal
		{project}
		sourceFolderId={folderId}
		folders={visibleFolders}
		onMove={(target) => handleMoveProject(project, folderId, target)}
		onClose={closeDialog}
	/>
{:else if dialog?.kind === 'delete-project'}
	{@const project = dialog.project}
	<ConfirmDeleteModal
		noun="project"
		name={project.title}
		remove={() => Projects.deleteProject({ path: { project_id: project.id } })}
		onClose={closeDialog}
	/>
{/if}

<style>
	/*
	 * driver.js forces `overflow: hidden !important` on the direct parent of the
	 * highlighted element (`:not(body):has(> .driver-active-element)`), which
	 * collapses sibling cards inside our project grid during the tour. Override
	 * it with a higher-specificity rule so the grid keeps its normal overflow.
	 */
	:global(:not(body):not(html):has(> .driver-active-element)) {
		overflow: visible !important;
	}
</style>
