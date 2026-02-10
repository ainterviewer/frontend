<script lang="ts">
	import { Analysis } from '$lib/api';
	import { toast } from 'svelte-sonner';
	import type { AnalysisCategoryPublic, AnnotationType } from '$lib/api/types.gen';
	import { generateColor } from '$lib/utils/colors';

	interface Props {
		open: boolean;
		projectId: string;
		category?: AnalysisCategoryPublic | null;
		defaultType?: AnnotationType;
		existingColors?: string[];
		onClose: () => void;
		onSave: () => void;
	}

	let {
		open,
		projectId,
		category = null,
		defaultType = 'tag',
		existingColors = [],
		onClose,
		onSave
	}: Props = $props();

	let newName = $state('');
	let newDescription = $state('');
	let newType = $state<AnnotationType>('tag');
	let newColor = $state('#000000');
	let newMin = $state<number | null>(null);
	let newMax = $state<number | null>(null);
	let isSaving = $state(false);

	$effect(() => {
		if (open) {
			if (category) {
				// Edit mode
				newName = category.name;
				newDescription = category.description || '';
				newType = category.type;
				newColor = category.color;
				newMin = category.min_value ?? null;
				newMax = category.max_value ?? null;
			} else {
				// Create mode
				newName = '';
				newDescription = '';
				newType = defaultType;
				newColor = generateColor(existingColors);
				newMin = null;
				newMax = null;
			}
		}
	});

	async function handleSave() {
		if (!newName || !projectId) return;

		isSaving = true;
		try {
			if (category) {
				// Update
				await Analysis.updateAnalysisCategory({
					path: { category_id: category.id },
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
			} else {
				// Create
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
			}
			onSave();
			onClose();
		} catch (e) {
			console.error('Failed to save category', e);
			toast.error('Failed to save category');
		} finally {
			isSaving = false;
		}
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-[1000] flex items-center justify-center overflow-auto bg-black/40"
		onclick={onClose}
		onkeydown={(e) => e.key === 'Escape' && onClose()}
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
				onclick={onClose}>&times;</button
			>
			<h2 class="mt-0 mb-6 text-2xl font-bold">
				{category ? 'Edit' : 'Create New'}
				{newType === 'tag' ? 'Tag' : 'Score'}
			</h2>

			<form
				onsubmit={(e) => {
					e.preventDefault();
					handleSave();
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
						onclick={onClose}
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={isSaving}
						class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50"
					>
						{isSaving
							? category
								? 'Saving...'
								: 'Creating...'
							: category
								? 'Save Changes'
								: 'Create Category'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
