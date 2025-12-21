<script lang="ts">
	import { page } from '$app/state';
	import { Analysis } from '$lib/api';
	import type { AnalysisCategoryPublic, AnnotationType } from '$lib/api/types.gen';
	import { generateColor } from '../colors';
	import { onMount } from 'svelte';

	// State
	let projectId = $derived(page.params.project_id);
	let categories = $state<AnalysisCategoryPublic[]>([]);
	let loading = $state(true);

	// Derived State
	let tags = $derived(categories.filter((c) => c.type === 'tag'));
	let scores = $derived(categories.filter((c) => c.type === 'score'));

	// UI State
	let activeDropdown = $state<string | null>(null);
	let isCreateModalOpen = $state(false);
	let isCreating = $state(false);
	let editingCategoryId = $state<string | null>(null);

	// Form State
	let newName = $state('');
	let newDescription = $state('');
	let newType = $state<AnnotationType>('tag');
	let newColor = $state('#000000');
	let newMin = $state<number | null>(null);
	let newMax = $state<number | null>(null);

	async function loadCategories() {
		if (!projectId) return;
		loading = true;
		try {
			const res = await Analysis.getAnalysisCategories({
				path: { project_id: projectId }
			});
			if (res.data) {
				categories = res.data;
			}
		} catch (e) {
			console.error('Failed to load categories', e);
			alert('Failed to load categories');
		} finally {
			loading = false;
		}
	}

	function openCreateModal(type: AnnotationType) {
		editingCategoryId = null;
		newType = type;
		newName = '';
		newDescription = '';
		newMin = null;
		newMax = null;
		// Generate a fresh color based on existing ones
		newColor = generateColor(categories.map((c) => c.color));
		isCreateModalOpen = true;
	}

	function openEditModal(category: AnalysisCategoryPublic) {
		editingCategoryId = category.id;
		newType = category.type;
		newName = category.name;
		newDescription = category.description || '';
		newColor = category.color;
		newMin = category.min_value ?? null;
		newMax = category.max_value ?? null;
		isCreateModalOpen = true;
		activeDropdown = null;
	}

	async function createCategory() {
		if (!newName) return;
		if (!projectId) return;

		isCreating = true;
		try {
			await Analysis.createAnalysisCategory({
				path: { project_id: projectId },
				body: {
					project_id: projectId,
					name: newName,
					description: newDescription || null,
					type: newType,
					color: newColor,
					min_value: newType === 'score' ? newMin : null,
					max_value: newType === 'score' ? newMax : null
				}
			});

			await loadCategories();
			isCreateModalOpen = false;
		} catch (e) {
			console.error('Failed to create category', e);
			alert('Failed to create category');
		} finally {
			isCreating = false;
		}
	}

	async function updateCategory() {
		if (!newName || !editingCategoryId || !projectId) return;

		isCreating = true;
		try {
			await Analysis.updateAnalysisCategory({
				path: { category_id: editingCategoryId },
				body: {
					project_id: projectId,
					name: newName,
					description: newDescription || null,
					type: newType,
					color: newColor,
					min_value: newType === 'score' ? newMin : null,
					max_value: newType === 'score' ? newMax : null
				}
			});

			await loadCategories();
			isCreateModalOpen = false;
		} catch (e) {
			console.error('Failed to update category', e);
			alert('Failed to update category');
		} finally {
			isCreating = false;
		}
	}

	async function deleteCategory(id: string) {
		if (!confirm('Are you sure you want to delete this category?')) return;
		try {
			await Analysis.deleteAnalysisCategory({
				path: { category_id: id }
			});
			await loadCategories();
		} catch (e) {
			console.error('Failed to delete category', e);
			alert('Failed to delete category');
		}
	}

	function toggleDropdown(e: MouseEvent, id: string) {
		e.stopPropagation();
		activeDropdown = activeDropdown === id ? null : id;
	}

	onMount(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (activeDropdown && !(e.target as Element).closest('.dropdown-container')) {
				activeDropdown = null;
			}
		};
		window.addEventListener('click', handleClickOutside);
		loadCategories();
		return () => window.removeEventListener('click', handleClickOutside);
	});

	$effect(() => {
		if (projectId) loadCategories();
	});
</script>

<div class="mb-6 flex items-center justify-between">
	<h1 class="text-2xl font-semibold text-gray-800">Annotate</h1>
</div>

<p class="mb-6 text-gray-600">Manage analysis categories and annotations for your project.</p>

{#if loading && categories.length === 0}
	<div class="flex justify-center py-8">
		<i class="fas fa-spinner fa-spin text-2xl text-gray-400"></i>
	</div>
{:else}
	<div class="space-y-8">
		<!-- Tags Section -->
		<section>
			<h3 class="mb-4 text-lg font-medium text-gray-800">Tags</h3>
			<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
				{#each tags as tag (tag.id)}
					<div
						class="flex flex-col rounded-lg bg-white shadow-md transition-shadow hover:shadow-lg"
					>
						<div class="grow p-4">
							<div class="mb-2 flex items-center gap-2">
								<h3 class="font-semibold text-gray-900">{tag.name}</h3>
							</div>
							<p class="line-clamp-2 text-sm text-gray-500" title={tag.description || ''}>
								{tag.description || 'No description'}
							</p>
						</div>
						<div class="flex items-center justify-between border-t border-gray-200 px-4 py-2">
							<span
								class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
								style="background-color: {tag.color}"
							>
								{tag.name}
							</span>
							<div class="dropdown-container relative">
								<button
									class="rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
									onclick={(e) => toggleDropdown(e, tag.id)}
									aria-label="Category actions"
								>
									<i class="fa-solid fa-ellipsis-vertical"></i>
								</button>
								{#if activeDropdown === tag.id}
									<div class="absolute right-0 z-10 mt-2 w-48 rounded-md bg-white py-1 shadow-lg">
										<button
											class="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
											onclick={() => openEditModal(tag)}
										>
											Edit
										</button>
										<button
											class="block w-full px-4 py-2 text-left text-sm text-red-700 hover:bg-red-50"
											onclick={() => deleteCategory(tag.id)}
										>
											Delete
										</button>
									</div>
								{/if}
							</div>
						</div>
					</div>
				{/each}

				<!-- New Tag Card -->
				<button
					class="flex min-h-[150px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-4 text-gray-500 transition-colors hover:border-blue-500 hover:text-blue-500"
					onclick={() => openCreateModal('tag')}
				>
					<i class="fa-solid fa-plus mb-2 text-xl"></i>
					<span class="font-medium">New Tag</span>
				</button>
			</div>
		</section>

		<!-- Scores Section -->
		<section>
			<h3 class="mb-4 text-lg font-medium text-gray-800">Scores</h3>
			<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
				{#each scores as score (score.id)}
					<div
						class="flex flex-col rounded-lg bg-white shadow-md transition-shadow hover:shadow-lg"
					>
						<div class="grow p-4">
							<div class="mb-2 flex items-center gap-2">
								<h3 class="font-semibold text-gray-900">{score.name}</h3>
							</div>
							<p class="mb-2 line-clamp-2 text-sm text-gray-500" title={score.description || ''}>
								{score.description || 'No description'}
							</p>
							{#if score.min_value != null || score.max_value != null}
								<div class="text-xs text-gray-400">
									Range: {score.min_value ?? '?'} - {score.max_value ?? '?'}
								</div>
							{/if}
						</div>
						<div class="flex items-center justify-between border-t border-gray-200 px-4 py-2">
							<span
								class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
								style="background-color: {score.color}"
							>
								{score.name}
							</span>
							<div class="dropdown-container relative">
								<button
									class="rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
									onclick={(e) => toggleDropdown(e, score.id)}
									aria-label="Category actions"
								>
									<i class="fa-solid fa-ellipsis-vertical"></i>
								</button>
								{#if activeDropdown === score.id}
									<div class="absolute right-0 z-10 mt-2 w-48 rounded-md bg-white py-1 shadow-lg">
										<button
											class="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
											onclick={() => openEditModal(score)}
										>
											Edit
										</button>
										<button
											class="block w-full px-4 py-2 text-left text-sm text-red-700 hover:bg-red-50"
											onclick={() => deleteCategory(score.id)}
										>
											Delete
										</button>
									</div>
								{/if}
							</div>
						</div>
					</div>
				{/each}

				<!-- New Score Card -->
				<button
					class="flex min-h-[150px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-4 text-gray-500 transition-colors hover:border-blue-500 hover:text-blue-500"
					onclick={() => openCreateModal('score')}
				>
					<i class="fa-solid fa-plus mb-2 text-xl"></i>
					<span class="font-medium">New Score</span>
				</button>
			</div>
		</section>
	</div>
{/if}

<!-- Create Category Modal -->
{#if isCreateModalOpen}
	<div
		class="fixed inset-0 z-[1000] flex items-center justify-center overflow-auto bg-black/40"
		onclick={() => (isCreateModalOpen = false)}
		onkeydown={(e) => e.key === 'Escape' && (isCreateModalOpen = false)}
		role="presentation"
	>
		<div
			class="relative m-auto w-full max-w-2xl rounded border border-[#888] bg-white p-10 shadow-xl"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
			tabindex="-1"
		>
			<button
				class="absolute top-2 right-4 border-none bg-transparent text-2xl font-bold text-[#aaa] hover:text-black"
				onclick={() => (isCreateModalOpen = false)}>&times;</button
			>
			<h2 class="mt-0 mb-6 text-2xl font-bold">
				{editingCategoryId ? 'Edit' : 'Create New'}
				{newType === 'tag' ? 'Tag' : 'Score'}
			</h2>

			<form
				onsubmit={(e) => {
					e.preventDefault();
					if (editingCategoryId) {
						updateCategory();
					} else {
						createCategory();
					}
				}}
				class="space-y-6"
			>
				<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
					<div>
						<label for="name" class="mb-1 block text-sm font-medium text-gray-700">Name</label>
						<input
							id="name"
							type="text"
							bind:value={newName}
							required
							class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
							placeholder="e.g. Sentiment, Topic"
						/>
					</div>

					<div>
						<label for="color" class="mb-1 block text-sm font-medium text-gray-700">Color</label>
						<div class="flex items-center gap-3">
							<input
								id="color"
								type="color"
								bind:value={newColor}
								class="h-10 w-20 cursor-pointer rounded border border-gray-300 p-1"
							/>
							<input
								type="text"
								bind:value={newColor}
								class="w-32 rounded-md border-gray-300 uppercase shadow-sm focus:border-blue-500 focus:ring-blue-500"
							/>
						</div>
					</div>
				</div>

				<div>
					<label for="description" class="mb-1 block text-sm font-medium text-gray-700"
						>Description</label
					>
					<input
						id="description"
						type="text"
						bind:value={newDescription}
						class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
						placeholder="Describe what this category analyzes..."
					/>
				</div>

				{#if newType === 'score'}
					<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
						<div>
							<label for="min" class="mb-1 block text-sm font-medium text-gray-700">Min Value</label
							>
							<input
								id="min"
								type="number"
								bind:value={newMin}
								class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
							/>
						</div>
						<div>
							<label for="max" class="mb-1 block text-sm font-medium text-gray-700">Max Value</label
							>
							<input
								id="max"
								type="number"
								bind:value={newMax}
								class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
							/>
						</div>
					</div>
				{/if}

				<div class="flex justify-end gap-2 pt-4">
					<button
						type="button"
						class="rounded border-none bg-gray-200 px-4 py-2 hover:bg-gray-300"
						onclick={() => (isCreateModalOpen = false)}
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={isCreating}
						class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50"
					>
						{isCreating
							? editingCategoryId
								? 'Saving...'
								: 'Creating...'
							: editingCategoryId
								? 'Save Changes'
								: 'Create Category'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
