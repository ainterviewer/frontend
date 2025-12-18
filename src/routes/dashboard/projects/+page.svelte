<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { LanguageDict, ProjectFolderWithProjects, ProjectPublic } from '$lib/api';
	import { Default } from '$lib/api';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import { mainSidebarItems } from '$lib/config/sidebar';
	import { onMount } from 'svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let folders: ProjectFolderWithProjects[] = $state(data.folders);
	let languages: LanguageDict[] = $state(data.languages);
	let isLoading = $state(false);

	// Modal States
	let isCreateFolderModalOpen = $state(false);
	let isDeleteFolderModalOpen = $state(false);
	let isEditFolderModalOpen = $state(false);

	let isCreateProjectModalOpen = $state(false);
	let isDeleteProjectModalOpen = $state(false);

	// Form Data
	// Folder Creation
	let createFolderName = $state('');
	let createFolderCollaborators: string[] = $state([]);

	// Folder Editing
	let editFolderName = $state('');

	// Project Creation
	let createProjectName = $state('');
	let createProjectLanguage = $state('EN');
	let selectedProject: ProjectPublic | null = $state(null);
	let deleteConfirmation = $state('');
	let createProjectFolderId: string | null = $state(null);

	// Folder Actions
	let selectedFolder: ProjectFolderWithProjects | null = $state(null);
	let deleteFolderConfirmation = $state('');

	// UI State
	let activeDropdown: string | null = $state(null);

	async function loadData() {
		isLoading = true;
		try {
			const [foldersRes, langRes] = await Promise.all([
				Default.getFolders(),
				Default.getLanguages()
			]);
			folders = (foldersRes as unknown as { data: ProjectFolderWithProjects[] }).data || foldersRes;
			languages = (langRes as unknown as { data: LanguageDict[] }).data || langRes;
		} catch (error) {
			console.error('Failed to load data:', error);
		} finally {
			isLoading = false;
		}
	}

	onMount(() => {
		// Close dropdowns when clicking outside
		const handleClickOutside = (e: MouseEvent) => {
			if (activeDropdown && !(e.target as Element).closest('.dropdown-container')) {
				activeDropdown = null;
			}
		};
		window.addEventListener('click', handleClickOutside);
		return () => window.removeEventListener('click', handleClickOutside);
	});

	async function addCollaborator() {
		createFolderCollaborators.push('');
	}

	async function handleCreateProject() {
		if (!createProjectFolderId) {
			console.error('No folder selected for project creation.');
			alert('Please select a folder to create a project in.');
			return;
		}
		try {
			await Default.createProject({
				body: {
					title: createProjectName,
					folder_id: createProjectFolderId,
					default_language: createProjectLanguage
				}
			});

			// Reset and refresh
			createProjectName = '';
			createProjectLanguage = 'EN';
			isCreateProjectModalOpen = false;
			createProjectFolderId = null; // Clear the selected folder ID
			await loadData();
		} catch (error) {
			console.error('Failed to create project:', error);
			alert('Failed to create project');
		}
	}

	async function handleCreateFolder() {
		try {
			await Default.createFolder({
				body: {
					title: createFolderName
				}
			});

			// Reset and refresh
			createFolderName = '';
			isCreateFolderModalOpen = false;
			await loadData();
		} catch (error) {
			console.error('Failed to create folder:', error);
			alert('Failed to create folder');
		}
	}

	function openEditFolderModal(folder: ProjectFolderWithProjects) {
		selectedFolder = folder;
		editFolderName = folder.title;
		isEditFolderModalOpen = true;
		activeDropdown = null;
	}

	async function handleEditFolder() {
		if (!selectedFolder) return;
		try {
			await Default.editFolder({
				body: {
					id: selectedFolder.id,
					title: editFolderName
				}
			});

			// Reset and refresh
			editFolderName = '';
			isEditFolderModalOpen = false;
			selectedFolder = null;
			await loadData();
		} catch (error) {
			console.error('Failed to edit folder:', error);
			alert('Failed to edit folder');
		}
	}

	function openDeleteFolderModal(folder: ProjectFolderWithProjects) {
		selectedFolder = folder;
		deleteFolderConfirmation = '';
		isDeleteFolderModalOpen = true;
		activeDropdown = null;
	}

	async function handleDeleteFolder() {
		if (!selectedFolder || deleteFolderConfirmation !== selectedFolder.title) return;

		try {
			await Default.deleteFolder({
				body: { id: selectedFolder.id }
			});
			isDeleteFolderModalOpen = false;
			selectedFolder = null;
			await loadData();
		} catch (error) {
			console.error('Failed to delete folder:', error);
			alert('Failed to delete folder');
		}
	}

	function openDeleteModal(project: ProjectPublic) {
		selectedProject = project;
		deleteConfirmation = '';
		isDeleteProjectModalOpen = true;
		activeDropdown = null;
	}

	async function handleDeleteProject() {
		if (!selectedProject || deleteConfirmation !== selectedProject.title) return;

		try {
			await Default.deleteProject({
				path: { project_id: selectedProject.id }
			});
			isDeleteProjectModalOpen = false;
			selectedProject = null;
			await loadData();
		} catch (error) {
			console.error('Failed to delete project:', error);
			alert('Failed to delete project');
		}
	}

	async function handleCloneProject(project: ProjectPublic) {
		try {
			await Default.cloneProject({
				path: { project_id: project.id }
			});
			activeDropdown = null;
			await loadData();
			// Could show success notification here
		} catch (error) {
			console.error('Failed to clone project:', error);
			alert('Failed to clone project');
		}
	}

	function handleRowClick(projectId: string, defaultLanguage: string) {
		// Mock navigation or real navigation if route exists
		// document.cookie = `project_id=${projectId}; path=/`; // Old app did this
		goto(resolve(`/dashboard/projects/${projectId}/${defaultLanguage}/guide`));
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

<div class="flex justify-between">
	<h1 class="page-title">Project Folders</h1>
	<div class="ml-auto flex rounded-lg transition-shadow hover:shadow-lg">
		<button
			class="flex border-none bg-transparent px-4 py-2 transition-transform active:translate-y-0.5"
			onclick={() => (isCreateFolderModalOpen = true)}
			title="Create new folder"
			aria-label="Create new folder"
		>
			<i class="fa-solid fa-folder-plus pr-2 text-xl"></i>
			New Folder
		</button>
	</div>
</div>

{#each folders as folder (folder.id)}
	<div class="relative mt-6 mb-2 flex items-center gap-2 border-t-2 border-primary pt-6">
		<i class="fa-solid fa-folder text-4xl text-secondary"></i>
		<h2 class="text-lg">{folder.title}</h2>
		<div class="dropdown-container relative">
			<button
				class="rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
				onclick={(e) => toggleDropdown(e, folder.id)}
				aria-label="Project actions"
			>
				<i class="fa-solid fa-ellipsis-vertical"></i>
			</button>
			{#if activeDropdown === folder.id}
				<div class="absolute left-0 z-10 mt-2 w-48 rounded-md bg-white py-1 shadow-lg">
					<button
						class="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
						onclick={() => openEditFolderModal(folder)}
					>
						Edit
					</button>
					<button
						class="block w-full px-4 py-2 text-left text-sm text-red-700 hover:bg-red-50"
						onclick={() => openDeleteFolderModal(folder)}
					>
						Delete
					</button>
				</div>
			{/if}
		</div>
	</div>
	<div class="mb-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
		{#each folder.projects as project (project.id)}
			<div
				class="flex flex-col rounded-lg bg-white shadow-md transition-shadow hover:shadow-lg"
				role="button"
				tabindex="0"
				onclick={() => handleRowClick(project.id, project.config.default_language ?? 'EN')}
				onkeydown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						handleRowClick(project.id, project.config.default_language ?? 'EN');
					}
				}}
			>
				<div class="grow p-4">
					<div class="flex">
						<h3 class="mb-1 w-full text-lg font-semibold">{project.title}</h3>
						<i class="fas fa-clipboard-list text-xl"></i>
					</div>

					<div class="flex flex-col gap-1 text-sm text-gray-500">
						<p>
							Created: {new Date(project.created_at).toLocaleDateString('en-GB')}
						</p>
						<p>
							Updated: {project.last_updated
								? new Date(project.last_updated).toLocaleDateString('en-GB', {
										hour: '2-digit',
										minute: '2-digit'
									})
								: 'N/A'}
						</p>
						<p>
							Respondents: {project.n_interviews}
						</p>
					</div>
				</div>
				<div class="flex items-center justify-between border-t border-gray-200 px-4 py-2">
					<p class="text-sm text-gray-500">
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
									onclick={() => handleCloneProject(project)}
								>
									Clone
								</button>
								<button
									class="block w-full px-4 py-2 text-left text-sm text-red-700 hover:bg-red-50"
									onclick={() => openDeleteModal(project)}
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
			class="flex items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-4 text-gray-500 transition-colors hover:border-primary hover:text-primary"
			role="button"
			tabindex="0"
			onclick={() => {
				isCreateProjectModalOpen = true;
				createProjectFolderId = folder.id; // Assign the current folder's ID
			}}
			onkeydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					isCreateProjectModalOpen = true;
					createProjectFolderId = folder.id;
				}
			}}
		>
			<i class="fa-solid fa-plus mr-2 text-xl"></i>
			New Project
		</div>
	</div>
{/each}
{#if folders.length === 0 && !isLoading}
	<div class="p-8 text-center text-gray-500">No folders found. Create one to get started!</div>
{/if}

<!-- Create Project Modal -->
{#if isCreateProjectModalOpen}
	<div
		class="fixed inset-0 z-[1000] flex items-center justify-center overflow-auto bg-black/40"
		onclick={() => (isCreateProjectModalOpen = false)}
		onkeydown={(e) => e.key === 'Escape' && (isCreateProjectModalOpen = false)}
		role="presentation"
	>
		<div
			class="relative m-auto w-1/2 max-w-lg rounded border border-[#888] bg-white p-10 shadow-xl"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
			tabindex="-1"
		>
			<button
				class="absolute top-2 right-4 border-none bg-transparent text-2xl font-bold text-[#aaa] hover:text-black"
				onclick={() => (isCreateProjectModalOpen = false)}>&times;</button
			>
			<h2 class="mt-0 mb-6 text-2xl font-bold">Create New Project</h2>

			<div class="mb-4">
				<label class="mb-2 block font-medium" for="project-name"
					>Project title <span class="text-red-500">*</span></label
				>
				<input
					type="text"
					id="project-name"
					class="box-border w-full rounded border border-gray-300 p-2"
					bind:value={createProjectName}
					placeholder="Enter project title"
				/>
			</div>

			<div class="mb-6">
				<label class="mb-2 block font-medium" for="language">Language</label>
				<select
					id="language"
					class="box-border w-full rounded border border-gray-300 bg-white p-2"
					bind:value={createProjectLanguage}
				>
					{#each languages as lang (lang.code)}
						<option value={lang.code}>{lang.name}</option>
					{/each}
				</select>
			</div>

			<div class="flex justify-end gap-2">
				<button
					class="rounded border-none bg-gray-200 px-4 py-2 hover:bg-gray-300"
					onclick={() => (isCreateProjectModalOpen = false)}>Cancel</button
				>
				<button
					class="rounded border-none bg-primary px-4 py-2 text-white hover:opacity-90 disabled:opacity-50"
					onclick={handleCreateProject}
					disabled={!createProjectName}
				>
					Create
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Delete Project Modal -->
{#if isDeleteProjectModalOpen && selectedProject}
	<div
		class="fixed inset-0 z-[1000] flex items-center justify-center overflow-auto bg-black/40"
		onclick={() => (isDeleteProjectModalOpen = false)}
		onkeydown={(e) => e.key === 'Escape' && (isDeleteProjectModalOpen = false)}
		role="presentation"
	>
		<div
			class="relative m-auto w-1/2 max-w-lg rounded border border-[#888] bg-white p-10 shadow-xl"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
			tabindex="-1"
		>
			<button
				class="absolute top-2 right-4 border-none bg-transparent text-2xl font-bold text-[#aaa] hover:text-black"
				onclick={() => (isDeleteProjectModalOpen = false)}>&times;</button
			>
			<h2 class="mt-0 mb-6 text-2xl font-bold">Delete Project</h2>

			<div class="mb-4">
				<p class="mb-4">
					Are you sure you want to delete this project?
					<br />
					This action cannot be undone.
				</p>

				<label class="mb-2 block font-medium" for="confirm-name">
					To confirm, type "<span class="font-bold">{selectedProject.title}</span>" in the box below
				</label>
				<input
					type="text"
					id="confirm-name"
					class="box-border w-full rounded border border-gray-300 p-2"
					bind:value={deleteConfirmation}
				/>
			</div>

			<div class="flex justify-end gap-2">
				<button
					class="rounded border-none bg-gray-200 px-4 py-2 hover:bg-gray-300"
					onclick={() => (isDeleteProjectModalOpen = false)}>Cancel</button
				>
				<button
					class="rounded border-none bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50"
					onclick={handleDeleteProject}
					disabled={deleteConfirmation !== selectedProject.title}
				>
					Delete
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Delete Folder Modal -->
{#if isDeleteFolderModalOpen && selectedFolder}
	<div
		class="fixed inset-0 z-[1000] flex items-center justify-center overflow-auto bg-black/40"
		onclick={() => (isDeleteFolderModalOpen = false)}
		onkeydown={(e) => e.key === 'Escape' && (isDeleteFolderModalOpen = false)}
		role="presentation"
	>
		<div
			class="relative m-auto w-1/2 max-w-lg rounded border border-[#888] bg-white p-10 shadow-xl"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
			tabindex="-1"
		>
			<button
				class="absolute top-2 right-4 border-none bg-transparent text-2xl font-bold text-[#aaa] hover:text-black"
				onclick={() => (isDeleteFolderModalOpen = false)}>&times;</button
			>
			<h2 class="mt-0 mb-6 text-2xl font-bold">Delete Folder</h2>

			<div class="mb-4">
				<p class="mb-4">
					Are you sure you want to delete this folder?
					<br />
					This action cannot be undone.
				</p>

				<label class="mb-2 block font-medium" for="confirm-folder-name">
					To confirm, type "<span class="font-bold">{selectedFolder.title}</span>" in the box below
				</label>
				<input
					type="text"
					id="confirm-folder-name"
					class="box-border w-full rounded border border-gray-300 p-2"
					bind:value={deleteFolderConfirmation}
				/>
			</div>

			<div class="flex justify-end gap-2">
				<button
					class="rounded border-none bg-gray-200 px-4 py-2 hover:bg-gray-300"
					onclick={() => (isDeleteFolderModalOpen = false)}>Cancel</button
				>
				<button
					class="rounded border-none bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50"
					onclick={handleDeleteFolder}
					disabled={deleteFolderConfirmation !== selectedFolder.title}
				>
					Delete
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Edit Folder Modal -->
{#if isEditFolderModalOpen && selectedFolder}
	<div
		class="fixed inset-0 z-[1000] flex items-center justify-center overflow-auto bg-black/40"
		onclick={() => (isEditFolderModalOpen = false)}
		onkeydown={(e) => e.key === 'Escape' && (isEditFolderModalOpen = false)}
		role="presentation"
	>
		<div
			class="relative m-auto w-1/2 max-w-lg rounded border border-[#888] bg-white p-10 shadow-xl"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
			tabindex="-1"
		>
			<button
				class="absolute top-2 right-4 border-none bg-transparent text-2xl font-bold text-[#aaa] hover:text-black"
				onclick={() => (isEditFolderModalOpen = false)}>&times;</button
			>
			<h2 class="mt-0 mb-6 text-2xl font-bold">Edit Folder</h2>

			<div class="mb-4">
				<label class="mb-2 block font-medium" for="edit-folder-name"
					>Folder title <span class="text-red-500">*</span></label
				>
				<input
					type="text"
					id="edit-folder-name"
					class="box-border w-full rounded border border-gray-300 p-2"
					bind:value={editFolderName}
					placeholder="Enter folder title"
				/>
			</div>

			<div class="flex justify-end gap-2">
				<button
					class="rounded border-none bg-gray-200 px-4 py-2 hover:bg-gray-300"
					onclick={() => (isEditFolderModalOpen = false)}>Cancel</button
				>
				<button
					class="rounded border-none bg-primary px-4 py-2 text-white hover:opacity-90 disabled:opacity-50"
					onclick={handleEditFolder}
					disabled={!editFolderName || editFolderName === selectedFolder.title}
				>
					Save Changes
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Create Folder Modal -->
{#if isCreateFolderModalOpen}
	<div
		class="fixed inset-0 z-[1000] flex items-center justify-center overflow-auto bg-black/40"
		onclick={() => (isCreateFolderModalOpen = false)}
		onkeydown={(e) => e.key === 'Escape' && (isCreateFolderModalOpen = false)}
	>
		<div
			class="relative m-auto w-1/2 max-w-lg rounded border border-[#888] bg-white p-10 shadow-xl"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
			tabindex="-1"
		>
			<button
				class="absolute top-2 right-4 border-none bg-transparent text-2xl font-bold text-[#aaa] hover:text-black"
				onclick={() => (isCreateFolderModalOpen = false)}>&times;</button
			>
			<h2 class="mt-0 mb-6 text-2xl font-bold">Create New Folder</h2>

			<div class="mb-4">
				<label class="mb-2 block font-medium" for="folder-name"
					>Folder title <span class="text-red-500">*</span></label
				>
				<input
					type="text"
					id="folder-name"
					class="box-border w-full rounded border border-gray-300 p-2"
					bind:value={createFolderName}
					placeholder="Enter folder title"
				/>
			</div>

			<div class="mb-4">
				<label class="mb-2 block font-medium" for="folder-name">Share</label>
				{#each createFolderCollaborators as _collaborator, i (i)}
					<div class="mb-2 flex">
						<input
							type="text"
							class="box-border w-full rounded border border-gray-300 p-2"
							bind:value={createFolderCollaborators[i]}
							placeholder="Email"
							autocomplete="off"
						/>
						<div class="ml-2 flex rounded-lg transition-shadow hover:bg-red-500 hover:shadow-lg">
							<button
								class="flex border-none bg-transparent px-4 py-2 transition-transform active:translate-y-[2px]"
								onclick={() => {
									createFolderCollaborators.splice(i, 1);
								}}
								aria-label="Remove collaborator"
							>
								<i class="fa-solid fa-trash content-center text-xl"></i>
							</button>
						</div>
					</div>
				{/each}
				<div class="flex w-fit rounded-lg transition-shadow hover:shadow-lg">
					<button
						class="flex border-none bg-transparent px-4 py-2
            transition-transform active:translate-y-[2px]"
						onclick={addCollaborator}
					>
						<i class="fa-solid fa-plus pr-2 text-xl"></i>
						Add collaborator
					</button>
				</div>
			</div>

			<div class="flex justify-end gap-2">
				<button
					class="rounded border-none bg-gray-200 px-4 py-2 hover:bg-gray-300"
					onclick={() => (isCreateFolderModalOpen = false)}>Cancel</button
				>
				<button
					class="rounded border-none bg-primary px-4 py-2 text-white hover:opacity-90 disabled:opacity-50"
					onclick={handleCreateFolder}
					disabled={!createFolderName}
				>
					Create
				</button>
			</div>
		</div>
	</div>
{/if}
