<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { CollaboratorRole, ProjectFolderWithProjects, ProjectPublic } from '$lib/api';
	import { Folders, Projects } from '$lib/api';
	import Info from '$lib/components/Info.svelte';
	import Select from '$lib/components/Select.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import { mainSidebarItems } from '$lib/config/sidebar';
	import { addSkipOnboardingButton, isOnboardingDisabled } from '$lib/onboarding';
	import { driver } from 'driver.js';
	import 'driver.js/dist/driver.css';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let folders = $derived(data.folders ?? []);
	let languages = $derived(data.languages ?? []);

	// Modal States
	let isCreateFolderModalOpen = $state(false);
	let isDeleteFolderModalOpen = $state(false);
	let isEditFolderModalOpen = $state(false);

	let isCreateProjectModalOpen = $state(false);
	let isDeleteProjectModalOpen = $state(false);

	// Form Data
	// Folder Creation
	let createFolderName = $state('');
	let createFolderCollaborators: { email: string; role: CollaboratorRole }[] = $state([]);

	// Folder Editing
	let editFolderName = $state('');
	let editCollaboratorEmail = $state('');
	let editCollaboratorRole: CollaboratorRole = $state('viewer');
	const roles: CollaboratorRole[] = ['viewer', 'annotator', 'editor', 'admin'];
	const roleItems = roles.map((r) => ({
		value: r,
		label: r.charAt(0).toUpperCase() + r.slice(1)
	}));

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
		await invalidateAll();
	}

	function startOnboarding() {
		const tour = driver({
			showProgress: true,
			onPopoverRender: (popover) => addSkipOnboardingButton(popover, tour),
			steps: [
				{
					popover: {
						title: 'Welcome to the AInterviewer platform 👋',
						description:
							"This interactive tour will guide you through the platform's features, and help you get started. Navigate the tour with the buttons below or with the arrow keys on your keyboard."
					}
				},
				{
					element: '[data-tour="header-menu-container"]',
					onHighlightStarted: () => {
						if (!document.querySelector('[data-tour="header-menu-dropdown"].visible')) {
							(document.querySelector('[data-tour="header-menu"]') as HTMLElement | null)?.click();
						}
					},
					onDeselected: () => {
						if (document.querySelector('[data-tour="header-menu-dropdown"].visible')) {
							(document.querySelector('[data-tour="header-menu"]') as HTMLElement | null)?.click();
						}
					},
					popover: {
						title: 'Global menu',
						description:
							'In the global dropdown menu you can logout at any time. in <u>Your profile</u> you can edit your user information, and manage how you see these interactive tours.'
					}
				},
				{
					element: '[data-tour="sidebar-home"]',
					popover: {
						title: 'Home',
						description:
							'Home is where your projects live. You group related projects under folders and can see the status of each project.'
					}
				},
				{
					element: '[data-tour="sidebar-experiments"]',
					popover: {
						title: 'Experiments',
						description:
							'The experiments tab is for an advanced feature, useful when you want to compare multiple different existing interview projects through random distribution.'
					}
				},
				{
					element: '[data-tour="new-folder"]',
					popover: {
						title: 'Create a folder',
						description:
							'Folders group related projects and let you invite and manage collaborators.'
					}
				},
				{
					element: '[data-tour="new-project"]',
					popover: {
						title: 'Add a project',
						description:
							'Inside a folder, create projects to get started on your interview guide and setup.'
					}
				},
				{
					element: '[data-tour="documentation"]',
					popover: {
						title: 'Read the documentation',
						description:
							'Consult our documentation site for more elaborate descriptions of the platform features and best practices.',
						side: 'top'
					}
				},
				{
					popover: {
						title: "That's it for the main dashboard!",
						description: 'Create and view a project to get started with your own AI-led interviews.'
					}
				}
			]
		});
		tour.drive();
	}

	onMount(() => {
		// Show the onboarding tour once per user, unless they opted out of all tours.
		if (!isOnboardingDisabled() && !localStorage.getItem('dashboard-onboarded')) {
			startOnboarding();
			localStorage.setItem('dashboard-onboarded', 'true');
		}

		// Close dropdowns when clicking outside
		const handleClickOutside = (e: MouseEvent) => {
			if (activeDropdown && !(e.target as Element).closest('.dropdown-container')) {
				activeDropdown = null;
			}
		};
		window.addEventListener('click', handleClickOutside);
		return () => window.removeEventListener('click', handleClickOutside);
	});

	function addCollaborator() {
		createFolderCollaborators.push({ email: '', role: 'viewer' });
	}

	async function handleCreateProject() {
		if (!createProjectFolderId) {
			console.error('No folder selected for project creation.');
			toast.error('Please select a folder to create a project in.');
			return;
		}
		const { error } = await Folders.createProject({
			path: {
				folder_id: createProjectFolderId
			},
			body: {
				title: createProjectName,
				default_language: createProjectLanguage
			}
		});
		if (error) {
			console.error('Failed to create project:', error);
			toast.error('Failed to create project');
			return;
		}
		// Reset and refresh
		createProjectName = '';
		createProjectLanguage = 'EN';
		isCreateProjectModalOpen = false;
		createProjectFolderId = null;
		await loadData();
	}

	async function handleCreateFolder() {
		const { error } = await Folders.createFolder({
			body: {
				title: createFolderName,
				// The API only accepts the `folder_collaborations` alias, not `collaborators`.
				folder_collaborations: createFolderCollaborators.filter((c) => c.email.trim() !== '')
			}
		});
		if (error) {
			console.error('Failed to create folder:', error);
			toast.error('Failed to create folder');
			return;
		}
		// Reset and refresh
		createFolderName = '';
		createFolderCollaborators = [];
		isCreateFolderModalOpen = false;
		await loadData();
	}

	function openEditFolderModal(folder: ProjectFolderWithProjects) {
		selectedFolder = folder;
		editFolderName = folder.title;
		editCollaboratorEmail = '';
		editCollaboratorRole = 'viewer';
		isEditFolderModalOpen = true;
		activeDropdown = null;
	}

	async function handleEditFolder() {
		if (!selectedFolder) return;
		const { error } = await Folders.editFolder({
			path: {
				folder_id: selectedFolder.id
			},
			body: {
				title: editFolderName
			}
		});
		if (error) {
			console.error('Failed to edit folder:', error);
			toast.error('Failed to edit folder');
			return;
		}
		// Reset and refresh
		editFolderName = '';
		isEditFolderModalOpen = false;
		selectedFolder = null;
		await loadData();
	}

	async function handleAddCollaborator(folderId: string) {
		if (!editCollaboratorEmail) return;
		const { error } = await Folders.addCollaborator({
			path: {
				folder_id: folderId
			},
			body: {
				email: editCollaboratorEmail,
				role: editCollaboratorRole
			}
		});
		if (error) {
			console.error('Failed to add collaborator:', error);
			toast.error('Failed to add collaborator');
			return;
		}
		editCollaboratorEmail = '';
		editCollaboratorRole = 'viewer';
		await loadData();
		if (selectedFolder) {
			const updatedFolder = folders.find((f) => f.id === selectedFolder!.id);
			if (updatedFolder) selectedFolder = updatedFolder;
		}
	}

	async function handleRemoveCollaborator(userId: string) {
		if (!selectedFolder) return;
		const { error } = await Folders.removeCollaborator({
			path: {
				folder_id: selectedFolder.id
			},
			query: {
				user_id: userId
			}
		});
		if (error) {
			console.error('Failed to remove collaborator:', error);
			toast.error('Failed to remove collaborator');
			return;
		}
		await loadData();
		if (selectedFolder) {
			const updatedFolder = folders.find((f) => f.id === selectedFolder!.id);
			if (updatedFolder) selectedFolder = updatedFolder;
		}
	}

	async function handleUpdateCollaboratorRole(userId: string, role: CollaboratorRole) {
		if (!selectedFolder) return;
		const { error } = await Folders.updateCollaboratorRole({
			path: {
				folder_id: selectedFolder.id
			},
			query: {
				user_id: userId,
				role
			}
		});
		if (error) {
			console.error('Failed to update role:', error);
			toast.error('Failed to update role');
			return;
		}
		await loadData();
		if (selectedFolder) {
			const updatedFolder = folders.find((f) => f.id === selectedFolder!.id);
			if (updatedFolder) selectedFolder = updatedFolder;
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

		const { error } = await Folders.deleteFolder({
			path: { folder_id: selectedFolder.id }
		});
		if (error) {
			console.error('Failed to delete folder:', error);
			toast.error('Failed to delete folder');
			return;
		}
		isDeleteFolderModalOpen = false;
		selectedFolder = null;
		await loadData();
	}

	function openDeleteModal(project: ProjectPublic) {
		selectedProject = project;
		deleteConfirmation = '';
		isDeleteProjectModalOpen = true;
		activeDropdown = null;
	}

	async function handleDeleteProject() {
		if (!selectedProject || deleteConfirmation !== selectedProject.title) return;

		const { error } = await Projects.deleteProject({
			path: { project_id: selectedProject.id }
		});
		if (error) {
			console.error('Failed to delete project:', error);
			toast.error('Failed to delete project');
			return;
		}
		isDeleteProjectModalOpen = false;
		selectedProject = null;
		await loadData();
	}

	async function handleCloneProject(project: ProjectPublic) {
		const { error } = await Projects.cloneProject({
			path: { project_id: project.id }
		});
		if (error) {
			console.error('Failed to clone project:', error);
			toast.error('Failed to clone project');
			return;
		}
		activeDropdown = null;
		await loadData();
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
	Welcome to <span class="bg-linear-to-r from-dark to-primary bg-clip-text text-transparent"
		>AInterviewer</span
	>
</h1>

<p class="mb-8 text-gray-600">
	On this page you can create and manage folders and projects.
	<!-- FIXME:  -->
	<!-- When you create a folder you can choose other users you want to collaborate with. The users your -->
	<!-- choose wil be able to access all projects in the folder. -->
</p>

<div class="flex justify-between">
	<h2 class="page-title">Folders</h2>
	<div class="ml-auto flex rounded-lg transition-shadow hover:shadow-lg">
		<button
			data-tour="new-folder"
			class="flex items-center border-none bg-transparent px-4 py-2 transition-transform active:translate-y-0.5"
			onclick={() => (isCreateFolderModalOpen = true)}
			title="Create new folder"
			aria-label="Create new folder"
		>
			<i class="fa-solid fa-folder-plus pr-2 text-xl"></i>
			New Folder
		</button>
	</div>
</div>

{#each folders as folder, folderIndex (folder.id)}
	<div class="relative mt-4 mb-2 flex items-center gap-2 border-t-2 border-primary pt-6">
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
				class="flex min-h-[190px] flex-col rounded-lg bg-white shadow-md transition-shadow hover:shadow-xl {activeDropdown !==
				project.id
					? 'hover:scale-101'
					: ''}"
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
						<i class="fas fa-clipboard-list ml-1 text-xl"></i>
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
									onclick={(e) => {
										e.stopPropagation();
										handleCloneProject(project);
									}}
								>
									Clone
								</button>
								<a
									class="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
									href={resolve(
										`/dashboard/projects/${project.id}/${project.config.default_language}/settings`
									)}
								>
									Settings
								</a>
								<button
									class="block w-full px-4 py-2 text-left text-sm text-red-700 hover:bg-red-50"
									onclick={(e) => {
										e.stopPropagation();
										openDeleteModal(project);
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
			class="flex min-h-[190px] items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-4 text-gray-500 transition-colors hover:border-primary hover:text-primary"
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
{#if folders.length === 0}
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
		class="fixed inset-0 z-1000 flex items-center justify-center overflow-auto bg-black/40"
		onclick={() => (isEditFolderModalOpen = false)}
		onkeydown={(e) => e.key === 'Escape' && (isEditFolderModalOpen = false)}
		role="presentation"
	>
		<div
			class="relative m-auto w-1/2 max-w-2xl rounded border border-[#888] bg-white p-10 shadow-xl"
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

			<div class="mt-6 mb-4">
				<label class="mb-2 block font-bold" for="edit-folder-collaborators">Collaborators</label>

				{#if selectedFolder.collaborators && selectedFolder.collaborators.length > 0}
					<div
						class="mb-2 grid grid-cols-[1fr_8rem_2rem] gap-2 px-1 text-sm font-bold text-gray-700"
					>
						<span>Email</span>
						<span
							>Role
							<Info>
								<div>
									<div class="mb-2 font-bold">Collaborator Role</div>
									<div class="text-sm">
										<div class="mb-2">
											<span class="font-bold text-gray-800">Viewer:</span> Can only view the project information
											and interviews but do no further action
										</div>
										<div class="mb-2">
											<span class="font-bold text-gray-800">Annotator:</span> Can view the project information
											and view and annotate interviews
										</div>
										<div class="mb-2">
											<span class="font-bold text-gray-800">Editor:</span> Can view and edit the interview
											guide and basic configuration
										</div>
										<div>
											<span class="font-bold text-gray-800">Admin:</span> Can change projects status from
											active to inactive and delete projects all together.
										</div>
									</div>
								</div>
							</Info>
						</span>
					</div>
					{#each selectedFolder.collaborators as collaborator (collaborator.id)}
						<div class="mb-2 grid grid-cols-[1fr_8rem_2rem] items-center gap-2 px-1">
							<div class="overflow-hidden">
								<span class="block truncate text-sm font-medium" title={collaborator.user.email}
									>{collaborator.user.email}</span
								>
							</div>
							<div class="w-32">
								<Select
									items={roleItems}
									value={collaborator.role}
									onValueChange={(val: string) =>
										handleUpdateCollaboratorRole(collaborator.user.id, val as CollaboratorRole)}
									class="text-md h-9 py-1"
								/>
							</div>
							<button
								class="flex h-9 items-center justify-center rounded text-red-500 hover:bg-red-200 hover:text-red-700"
								onclick={() => handleRemoveCollaborator(collaborator.user.id)}
								aria-label="Remove collaborator"
							>
								<i class="fa-solid fa-trash"></i>
							</button>
						</div>
					{/each}
				{/if}

				<div class="mt-4 grid grid-cols-[1fr_8rem_2rem] items-center gap-2 px-1">
					<input
						type="text"
						class="w-full rounded border border-gray-300 p-2"
						placeholder="Add collaborator email"
						bind:value={editCollaboratorEmail}
					/>
					<div class="w-32">
						<Select items={roleItems} bind:value={editCollaboratorRole} class="text-md h-9 py-1" />
					</div>
					<button
						class="flex h-9 w-full items-center justify-center rounded bg-primary text-white hover:opacity-90 disabled:opacity-50"
						onclick={() => handleAddCollaborator(selectedFolder!.id)}
						disabled={!editCollaboratorEmail}
						aria-label="Add collaborator"
					>
						<i class="fa-solid fa-plus"></i>
					</button>
				</div>
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
		class="fixed inset-0 z-1000 flex items-center justify-center overflow-auto bg-black/40"
		onclick={() => (isCreateFolderModalOpen = false)}
		onkeydown={(e) => e.key === 'Escape' && (isCreateFolderModalOpen = false)}
		role="presentation"
	>
		<div
			class="relative m-auto w-1/2 max-w-2xl rounded border border-[#888] bg-white p-10 shadow-xl"
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

			<div class="mt-6 mb-4">
				<label class="mb-2 block font-bold" for="create-folder-collaborators">Collaborators</label>

				{#if createFolderCollaborators.length > 0}
					<div
						class="mb-2 grid grid-cols-[1fr_8rem_2rem] gap-2 px-1 text-sm font-bold text-gray-700"
					>
						<span>Email</span>
						<span
							>Role
							<Info>
								<div>
									<div class="mb-2 font-bold">Collaborator Role</div>
									<div class="text-sm">
										<div class="mb-2">
											<span class="font-bold text-gray-800">Viewer:</span> Can only view the project information
											and interviews but do no further action
										</div>
										<div class="mb-2">
											<span class="font-bold text-gray-800">Annotator:</span> Can view the project information
											and view and annotate interviews
										</div>
										<div class="mb-2">
											<span class="font-bold text-gray-800">Editor:</span> Can view and edit the interview
											guide and basic configuration
										</div>
										<div>
											<span class="font-bold text-gray-800">Admin:</span> Can change projects status from
											active to inactive and delete projects all together.
										</div>
									</div>
								</div>
							</Info>
						</span>
					</div>
					{#each createFolderCollaborators as collaborator, i (i)}
						<div class="mb-2 grid grid-cols-[1fr_8rem_2rem] items-center gap-2 px-1">
							<input
								type="text"
								class="w-full rounded border border-gray-300 p-2"
								bind:value={collaborator.email}
								placeholder="Email"
							/>
							<div class="w-32">
								<Select items={roleItems} bind:value={collaborator.role} class="text-md h-9 py-1" />
							</div>
							<button
								class="flex h-9 items-center justify-center rounded text-red-500 hover:bg-red-200 hover:text-red-700"
								onclick={() => createFolderCollaborators.splice(i, 1)}
								aria-label="Remove collaborator"
							>
								<i class="fa-solid fa-trash"></i>
							</button>
						</div>
					{/each}
				{/if}

				<div class="mt-4 flex w-fit rounded-lg transition-shadow hover:shadow-lg">
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
