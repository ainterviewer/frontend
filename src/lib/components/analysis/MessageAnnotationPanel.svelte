<script lang="ts">
	import type {
		AnalysisCategoryPublic,
		AnnotationType,
		AnnotationValueCreate,
		MessageAnnotationPublic
	} from '$lib/api/types.gen';
	import CategoryModal from '$lib/components/analysis/CategoryModal.svelte';
	import HoverInfo from '$lib/components/HoverInfo.svelte';
	import Info from '$lib/components/Info.svelte';
	import { getContrastColor } from '$lib/utils/colors';

	interface Props {
		categories: AnalysisCategoryPublic[];
		annotation?: MessageAnnotationPublic | null;
		projectId: string;
		onSave: (values: AnnotationValueCreate[], shouldClose?: boolean) => void;
		onDelete?: () => void;
		onCancel: () => void;
		onCategoryCreated?: () => void;
		saving?: boolean;
	}

	let {
		categories,
		annotation = null,
		projectId,
		onSave,
		onDelete,
		onCancel,
		onCategoryCreated,
		saving = false
	}: Props = $props();

	// Derived state
	let tags = $derived(categories.filter((c) => c.type === 'tag'));
	let scores = $derived(categories.filter((c) => c.type === 'score'));

	// Form state - initialize from existing annotation if present
	let selectedTags = $state<Set<string>>(new Set());
	let scoreValues = $state<Map<string, number>>(new Map());
	let isInitialized = false;

	let isCategoryModalOpen = $state(false);
	let modalDefaultType = $state<AnnotationType>('tag');

	// Initialize form state from existing annotation
	$effect(() => {
		if (!isInitialized) {
			if (annotation) {
				const tagIds = new Set<string>();
				const scoreMap = new Map<string, number>();

				for (const value of annotation.values) {
					const category = categories.find((c) => c.id === value.category_id);
					if (category) {
						if (category.type === 'tag') {
							// For tags, value_int = 1 means selected
							if (value.value_int === 1) {
								tagIds.add(value.category_id);
							}
						} else if (category.type === 'score') {
							scoreMap.set(value.category_id, value.value_int);
						}
					}
				}

				selectedTags = tagIds;
				scoreValues = scoreMap;
			} else {
				selectedTags = new Set();
				scoreValues = new Map();
			}
			isInitialized = true;
		}
	});

	function triggerSave(shouldClose: boolean) {
		const values: AnnotationValueCreate[] = [];

		// Add selected tags
		for (const tagId of selectedTags) {
			values.push({
				category_id: tagId,
				value_int: 1
			});
		}

		// Add score values
		for (const [categoryId, value] of scoreValues) {
			values.push({
				category_id: categoryId,
				value_int: value
			});
		}

		onSave(values, shouldClose);
	}

	function toggleTag(categoryId: string) {
		const newSet = new Set(selectedTags);
		if (newSet.has(categoryId)) {
			newSet.delete(categoryId);
		} else {
			newSet.add(categoryId);
		}
		selectedTags = newSet;
		triggerSave(false);
	}

	function setScore(categoryId: string, value: number) {
		if (scoreValues.get(categoryId) === value) {
			clearScore(categoryId);
			return;
		}
		const newMap = new Map(scoreValues);
		newMap.set(categoryId, value);
		scoreValues = newMap;
		triggerSave(false);
	}

	function clearScore(categoryId: string) {
		const newMap = new Map(scoreValues);
		newMap.delete(categoryId);
		scoreValues = newMap;
		triggerSave(false);
	}

	function openCreateModal(type: AnnotationType) {
		modalDefaultType = type;
		isCategoryModalOpen = true;
	}
</script>

<div class="rounded-lg border border-gray-200 bg-white shadow-lg">
	<div class="flex items-center justify-between border-b border-gray-200 px-4 py-3">
		<h3 class="text-sm font-semibold text-gray-800">
			{annotation ? 'Edit Annotation' : 'Add Annotation'}
		</h3>
		{#if annotation && onDelete}
			<button
				type="button"
				class="text-sm text-red-600 hover:text-red-700"
				onclick={onDelete}
				disabled={saving}
			>
				Delete
			</button>
		{/if}
	</div>

	<div class="max-h-96 space-y-4 p-4">
		<!-- Tags Section -->
		{#if tags.length > 0 || true}
			<fieldset>
				<legend class="mb-2 block text-xs font-medium tracking-wide text-gray-500 uppercase">
					Tags
				</legend>
				<div class="flex flex-wrap gap-2">
					{#each tags as tag (tag.id)}
						<HoverInfo text={tag.description || tag.name} asChild>
							{#snippet children({ props })}
								<button
									{...props}
									type="button"
									class="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-all {selectedTags.has(
										tag.id
									)
										? 'ring-2 ring-offset-1'
										: 'opacity-60 hover:opacity-100'}"
									style="background-color: {tag.color}; color: {getContrastColor(
										tag.color
									)}; {selectedTags.has(tag.id) ? `ring-color: ${tag.color}` : ''}"
									onclick={() => toggleTag(tag.id)}
									disabled={saving}
								>
									{#if selectedTags.has(tag.id)}
										<i class="fa-solid fa-check mr-1.5 text-[10px]"></i>
									{/if}
									{tag.name}
								</button>
							{/snippet}
						</HoverInfo>
					{/each}

					<!-- New Tag Button -->
					<button
						type="button"
						class="inline-flex items-center rounded-full border border-dashed border-gray-300 bg-transparent px-3 py-1 text-xs font-medium text-gray-500 hover:border-gray-400 hover:text-gray-700 disabled:opacity-50"
						onclick={() => openCreateModal('tag')}
						disabled={saving}
					>
						<i class="fa-solid fa-plus mr-1.5 text-[10px]"></i>
						New Tag
					</button>
				</div>
			</fieldset>
		{/if}

		<!-- Scores Section -->
		{#if scores.length > 0}
			<fieldset>
				<legend class="mb-2 block text-xs font-medium tracking-wide text-gray-500 uppercase">
					Scores
				</legend>
				<div class="space-y-3">
					{#each scores as score (score.id)}
						{@const min = score.min_value ?? 1}
						{@const max = score.max_value ?? 5}
						{@const currentValue = scoreValues.get(score.id)}
						<div class="w-fit rounded-md border border-gray-100 bg-gray-50 p-2">
							<div class="mb-1.5 flex items-center justify-between">
								<div class="flex items-center gap-1.5">
									<span class="text-xs font-medium text-gray-700">
										{score.name}
									</span>
									{#if score.description}
										<Info text={score.description} />
									{/if}
								</div>
								{#if currentValue !== undefined}
									<button
										type="button"
										class="text-xs text-gray-400 hover:text-gray-600"
										onclick={() => clearScore(score.id)}
										aria-label="Clear {score.name} score"
										disabled={saving}
									>
										<i class="fa-solid fa-xmark"></i>
									</button>
								{/if}
							</div>
							<div class="flex items-center gap-1">
								{#each { length: max - min + 1 } as _, i}
									{@const value = min + i}
									<button
										type="button"
										class="flex h-7 w-7 items-center justify-center rounded text-xs font-medium transition-all {currentValue ===
										value
											? 'text-white'
											: 'bg-white text-gray-600 hover:bg-gray-100'}"
										style={currentValue === value ? `background-color: ${score.color}` : ''}
										onclick={() => setScore(score.id, value)}
										disabled={saving}
									>
										{value}
									</button>
								{/each}
							</div>
						</div>
					{/each}
				</div>
			</fieldset>
		{/if}
	</div>

	<!-- Actions -->
	<div class="flex items-center justify-end border-t border-gray-200 px-4 py-3">
		<button
			type="button"
			class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
			onclick={onCancel}
			disabled={saving}
		>
			Close
		</button>
	</div>
</div>

<CategoryModal
	open={isCategoryModalOpen}
	{projectId}
	defaultType={modalDefaultType}
	existingColors={categories.map((c) => c.color)}
	onClose={() => (isCategoryModalOpen = false)}
	onSave={() => onCategoryCreated?.()}
/>
