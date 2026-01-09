<script lang="ts">
	import type {
		AnalysisCategoryPublic,
		MessageAnnotationPublic,
		AnnotationValueCreate
	} from '$lib/api/types.gen';
	import { getContrastColor } from '../../analysis/colors';
	import HoverInfo from '$lib/components/HoverInfo.svelte';

	interface Props {
		categories: AnalysisCategoryPublic[];
		annotation?: MessageAnnotationPublic | null;
		onSave: (
			values: AnnotationValueCreate[],
			comment: string | null,
			shouldClose?: boolean
		) => void;
		onDelete?: () => void;
		onCancel: () => void;
		saving?: boolean;
	}

	let {
		categories,
		annotation = null,
		onSave,
		onDelete,
		onCancel,
		saving = false
	}: Props = $props();

	// Derived state
	let tags = $derived(categories.filter((c) => c.type === 'tag'));
	let scores = $derived(categories.filter((c) => c.type === 'score'));

	// Form state - initialize from existing annotation if present
	let selectedTags = $state<Set<string>>(new Set());
	let scoreValues = $state<Map<string, number>>(new Map());
	let comment = $state('');
	let isInitialized = false;
	let isSavingComment = $state(false);

	// Reset isSavingComment when saving completes
	$effect(() => {
		if (!saving) {
			isSavingComment = false;
		}
	});

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
				comment = annotation.comment || '';
			} else {
				selectedTags = new Set();
				scoreValues = new Map();
				comment = '';
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

		onSave(values, comment.trim() || null, shouldClose);
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

	function handleSave() {
		isSavingComment = true;
		triggerSave(true);
	}

	let hasChanges = $derived.by(() => {
		// Check if there are any values to save
		return selectedTags.size > 0 || scoreValues.size > 0 || comment.trim().length > 0;
	});
</script>

<div class="rounded-lg border border-gray-200 bg-white shadow-lg">
	<div class="border-b border-gray-200 px-4 py-3">
		<h3 class="text-sm font-semibold text-gray-800">
			{annotation ? 'Edit Annotation' : 'Add Annotation'}
		</h3>
	</div>

	<div class="max-h-96 space-y-4 p-4">
		<!-- Tags Section -->
		{#if tags.length > 0}
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
						<div class="rounded-md border border-gray-100 bg-gray-50 p-2">
							<div class="mb-1.5 flex items-center justify-between">
								<div class="flex items-center gap-1.5">
									<span class="text-xs font-medium text-gray-700">
										{score.name}
									</span>
									{#if score.description}
										<HoverInfo text={score.description} />
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

		<!-- Comment Section -->
		<div>
			<label
				for="annotation-comment"
				class="mb-2 block text-xs font-medium tracking-wide text-gray-500 uppercase"
			>
				Comment
			</label>
			<textarea
				id="annotation-comment"
				bind:value={comment}
				rows="3"
				class="w-full resize-none rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:opacity-50"
				placeholder="Add a note about this message..."
			></textarea>
		</div>
	</div>

	<!-- Actions -->
	<div class="flex items-center justify-between border-t border-gray-200 px-4 py-3">
		<div>
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
		<div class="flex gap-2">
			<button
				type="button"
				class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
				onclick={onCancel}
				disabled={saving}
			>
				Cancel
			</button>
			<button
				type="button"
				class="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
				onclick={handleSave}
				disabled={isSavingComment || !hasChanges}
			>
				{#if isSavingComment && saving}
					<i class="fa-solid fa-spinner fa-spin mr-1"></i>
				{/if}
				{annotation ? 'Save Comment' : 'Save'}
			</button>
		</div>
	</div>
</div>
