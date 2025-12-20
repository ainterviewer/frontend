<script lang="ts">
	import { page } from '$app/state';
	import { Analysis } from '$lib/api';
	import type { AnalysisCategoryPublic, AnnotationType } from '$lib/api/types.gen';
	import { generateColor } from '../colors';

	// State
	let projectId = $derived(page.params.project_id);
	let categories = $state<AnalysisCategoryPublic[]>([]);
	let loading = $state(true);

	// Form State
	let newName = $state('');
	let newDescription = $state('');
	let newType = $state<AnnotationType>('tag');
	let newColor = $state('#000000');
	let newMin = $state<number | null>(null);
	let newMax = $state<number | null>(null);
	let isCreating = $state(false);

	async function loadCategories() {
		if (!projectId) return;
		loading = true;
		try {
			const res = await Analysis.getAnalysisCategories({
				path: { project_id: projectId }
			});
			if (res.data) {
				categories = res.data;
				// Generate a fresh color based on existing ones
				newColor = generateColor(categories.map((c) => c.color));
			}
		} catch (e) {
			console.error('Failed to load categories', e);
			alert('Failed to load categories');
		} finally {
			loading = false;
		}
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

			// Reset form
			newName = '';
			newDescription = '';
			newType = 'tag';
			newMin = null;
			newMax = null;

			await loadCategories();
		} catch (e) {
			console.error('Failed to create category', e);
			alert('Failed to create category');
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

	$effect(() => {
		loadCategories();
	});
</script>

<div class="mb-6 flex items-center justify-between">
	<h1 class="text-2xl font-semibold text-gray-800">Annotate</h1>
</div>

<p class="mb-6 text-gray-600">Manage analysis categories and annotations for your project.</p>

<div class="space-y-8">
	<!-- Create Category Section -->
	<section class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
		<h3 class="mb-4 text-lg font-medium text-gray-800">Create New Category</h3>

		<form
			onsubmit={(e) => {
				e.preventDefault();
				createCategory();
			}}
			class="space-y-4"
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
					<label for="type" class="mb-1 block text-sm font-medium text-gray-700">Type</label>
					<select
						id="type"
						bind:value={newType}
						class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
					>
						<option value="tag">Tag</option>
						<option value="score">Score</option>
					</select>
				</div>
			</div>

			<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
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
			</div>

			{#if newType === 'score'}
				<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
					<div>
						<label for="min" class="mb-1 block text-sm font-medium text-gray-700">Min Value</label>
						<input
							id="min"
							type="number"
							bind:value={newMin}
							class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
						/>
					</div>
					<div>
						<label for="max" class="mb-1 block text-sm font-medium text-gray-700">Max Value</label>
						<input
							id="max"
							type="number"
							bind:value={newMax}
							class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
						/>
					</div>
				</div>
			{/if}

			<div class="flex justify-end">
				<button
					type="submit"
					disabled={isCreating}
					class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50"
				>
					{isCreating ? 'Creating...' : 'Create Category'}
				</button>
			</div>
		</form>
	</section>

	<!-- List Categories Section -->
	<section class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
		<h3 class="mb-4 text-lg font-medium text-gray-800">Existing Categories</h3>

		{#if loading}
			<div class="flex justify-center py-8">
				<i class="fas fa-spinner fa-spin text-2xl text-gray-400"></i>
			</div>
		{:else if categories.length === 0}
			<p class="py-8 text-center text-gray-500">No categories found. Create one above.</p>
		{:else}
			<div class="overflow-hidden rounded-md border border-gray-200">
				<table class="min-w-full divide-y divide-gray-200">
					<thead class="bg-gray-50">
						<tr>
							<th
								scope="col"
								class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
								>Name</th
							>
							<th
								scope="col"
								class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
								>Type</th
							>
							<th
								scope="col"
								class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
								>Description</th
							>
							<th
								scope="col"
								class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
								>Actions</th
							>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-200 bg-white">
						{#each categories as category}
							<tr>
								<td class="px-6 py-4 whitespace-nowrap">
									<div class="flex items-center">
										<div
											class="mr-3 h-4 w-4 rounded-full border border-gray-200 shadow-sm"
											style="background-color: {category.color};"
										></div>
										<div class="text-sm font-medium text-gray-900">{category.name}</div>
									</div>
								</td>
								<td class="px-6 py-4 whitespace-nowrap">
									<span
										class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize
										{category.type === 'tag' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}"
									>
										{category.type}
									</span>
									{#if category.type === 'score' && (category.min_value != null || category.max_value != null)}
										<span class="ml-2 text-xs text-gray-500">
											({category.min_value ?? '?'} - {category.max_value ?? '?'})
										</span>
									{/if}
								</td>
								<td class="px-6 py-4">
									<div
										class="max-w-xs truncate text-sm text-gray-500"
										title={category.description || ''}
									>
										{category.description || '-'}
									</div>
								</td>
								<td class="px-6 py-4 text-right text-sm font-medium whitespace-nowrap">
									<button
										onclick={() => deleteCategory(category.id)}
										class="text-red-600 hover:text-red-900"
									>
										Delete
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</section>
</div>
