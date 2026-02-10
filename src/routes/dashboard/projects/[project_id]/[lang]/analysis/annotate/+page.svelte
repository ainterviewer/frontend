<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { Analysis } from '$lib/api';
	import toast from 'svelte-hot-french-toast';
	import type { AnalysisCategoryPublic, AnnotationType } from '$lib/api/types.gen';
	import { getContrastColor } from '$lib/utils/colors';
	import CategoryModal from '$lib/components/analysis/CategoryModal.svelte';
	import { onMount } from 'svelte';

	// State
	let projectId = $derived(page.params.project_id);
	let lang = $derived(page.params.lang);
	let categories = $state<AnalysisCategoryPublic[]>([]);
	let categoryCounts = $state<Record<string, number>>({});
	let loading = $state(true);

	// Derived State
	let tags = $derived(categories.filter((c) => c.type === 'tag'));
	let scores = $derived(categories.filter((c) => c.type === 'score'));

	// UI State
	let activeDropdown = $state<string | null>(null);
	let isCreateModalOpen = $state(false);
	let editingCategory = $state<AnalysisCategoryPublic | null>(null);
	let modalDefaultType = $state<AnnotationType>('tag');

	async function loadCategories() {
		if (!projectId) return;
		loading = true;
		try {
			const res = await Analysis.getAnalysisCategories({
				path: { project_id: projectId }
			});
			if (res.data) {
				categories = res.data;
				const counts: Record<string, number> = {};
				await Promise.all(
					categories.map(async (c) => {
						try {
							const { data } = await Analysis.getFilteredMessagesCount({
								path: { project_id: projectId },
								body: { category_ids: [c.id] }
							});
							if (data !== undefined) counts[c.id] = data;
						} catch (e) {
							console.error(`Failed to load count for category ${c.id}`, e);
						}
					})
				);
				categoryCounts = counts;
			}
		} catch (e) {
			console.error('Failed to load categories', e);
			toast.error('Failed to load categories');
		} finally {
			loading = false;
		}
	}

	function openCreateModal(type: AnnotationType) {
		editingCategory = null;
		modalDefaultType = type;
		isCreateModalOpen = true;
	}

	function openEditModal(category: AnalysisCategoryPublic) {
		editingCategory = category;
		isCreateModalOpen = true;
		activeDropdown = null;
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
			toast.error('Failed to delete category');
		}
	}

	function toggleDropdown(e: MouseEvent, id: string) {
		e.stopPropagation();
		activeDropdown = activeDropdown === id ? null : id;
	}

	function navigateToCategory(id: string) {
		const params = new URLSearchParams();
		params.append('category_id', id);
		goto(
			`/dashboard/projects/${projectId}/${lang}/analysis/annotate/messages?${params.toString()}`
		);
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
	<a
		href={`/dashboard/projects/${projectId}/${lang}/analysis/annotate/messages`}
		class="rounded-md bg-blue-600 px-4 py-2 text-sm text-white transition-colors hover:bg-blue-700"
	>
		<i class="fa-solid fa-search mr-2"></i>
		Browse & Search Messages
	</a>
</div>

<p class="mb-6 text-gray-600">
	Manage and browse analytical categories and scores for your project.
</p>

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
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<div
						class="flex cursor-pointer flex-col rounded-lg bg-white shadow-md transition-shadow hover:shadow-lg"
						onclick={() => navigateToCategory(tag.id)}
						role="button"
						tabindex="0"
					>
						<div class="grow p-4">
							<div class="mb-2 flex items-center gap-2">
								<h3 class="font-semibold text-gray-900">{tag.name}</h3>
								<span
									class="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600"
								>
									{categoryCounts[tag.id] ?? 0}
								</span>
							</div>
							<p class="line-clamp-2 text-sm text-gray-500" title={tag.description || ''}>
								{tag.description || 'No description'}
							</p>
						</div>
						<div class="flex items-center justify-between border-t border-gray-200 px-4 py-2">
							<span
								class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
								style="background-color: {tag.color}; color: {getContrastColor(tag.color)}"
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
									<div
										class="absolute right-0 z-10 mt-2 w-48 rounded-md bg-white py-1 shadow-lg"
										onclick={(e) => e.stopPropagation()}
									>
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
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<div
						class="flex cursor-pointer flex-col rounded-lg bg-white shadow-md transition-shadow hover:shadow-lg"
						onclick={() => navigateToCategory(score.id)}
						role="button"
						tabindex="0"
					>
						<div class="grow p-4">
							<div class="mb-2 flex items-center gap-2">
								<h3 class="font-semibold text-gray-900">{score.name}</h3>
								<span
									class="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600"
								>
									{categoryCounts[score.id] ?? 0}
								</span>
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
								style="background-color: {score.color}; color: {getContrastColor(score.color)}"
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
									<div
										class="absolute right-0 z-10 mt-2 w-48 rounded-md bg-white py-1 shadow-lg"
										onclick={(e) => e.stopPropagation()}
									>
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

<CategoryModal
	open={isCreateModalOpen}
	projectId={projectId ?? ''}
	category={editingCategory}
	defaultType={modalDefaultType}
	existingColors={categories.map((c) => c.color)}
	onClose={() => (isCreateModalOpen = false)}
	onSave={loadCategories}
/>
