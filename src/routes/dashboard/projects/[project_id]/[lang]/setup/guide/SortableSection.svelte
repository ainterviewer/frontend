<script lang="ts">
	import { useSortable } from '@dnd-kit-svelte/svelte/sortable';
	import { CollisionPriority } from '@dnd-kit/abstract';
	import SortableQuestion from './SortableQuestion.svelte';
	import type { GuideQuestion, GuideSection } from './types';

	interface Props {
		section: GuideSection;
		questions: GuideQuestion[];
		sectionIndex: number;
		onRemove: () => void;
		onGenerateQuestion?: () => void;
		isOverlay?: boolean;
	}

	let {
		section,
		questions,
		sectionIndex,
		onRemove,
		onGenerateQuestion,
		isOverlay = false
	}: Props = $props();

	const { ref, handleRef, isDragging } = useSortable({
		id: section.id,
		index: () => sectionIndex,
		type: 'section',
		data: {
			type: 'section',
			section
		},
		accept: ['question', 'section'],
		collisionPriority: CollisionPriority.Low
	});

	function addQuestion() {
		const newId = crypto.randomUUID();
		questions.push({
			id: newId,
			main_question: '',
			description: '',
			probes: [],
			max_probes_n: 3,
			max_probes_time: null,
			can_answer: true,
			can_skip: true,
			alternative_main_questions: []
		});
	}

	function removeQuestion(idx: number) {
		questions.splice(idx, 1);
	}
</script>

<div
	id={section.id}
	class="group relative rounded-lg border border-black bg-secondary p-4"
	class:opacity-50={isDragging.current && !isOverlay}
	class:shadow-xl={isOverlay}
	class:rotate-1={isOverlay}
	{@attach ref}
>
	<!-- Section Header/Controls -->
	<div class="mb-4 flex items-start justify-between">
		<div class="flex items-center gap-2">
			<span class="font-bold text-black">Section {sectionIndex + 1}</span>
			<div
				class="cursor-grab rounded px-1 text-gray-800 outline-none hover:bg-white/50"
				{@attach handleRef}
			>
				<i class="fa-solid fa-grip"></i>
			</div>
		</div>
		<button
			class="cursor-pointer rounded p-2 text-gray-700 transition hover:text-red-500"
			onclick={onRemove}
		>
			<i class="fa-solid fa-trash"></i>
		</button>
	</div>

	<div class="mb-4">
		<label class="mb-1 block text-sm font-bold text-gray-700">Description</label>
		<textarea
			class="h-22 w-full resize-none rounded-md border-gray-200 bg-gray-50 p-3 text-sm font-medium transition-colors focus:border-primary focus:bg-white focus:ring-primary/20"
			bind:value={section.description}
		></textarea>
	</div>

	<div class="mb-4 flex gap-4 text-sm">
		<label class="flex cursor-pointer items-center gap-2">
			<input
				type="checkbox"
				class="rounded border-gray-300 text-primary focus:ring-primary"
				bind:checked={section.shuffle}
			/>
			Shuffle section
		</label>
	</div>

	<h4 class="mb-2 font-medium">Questions</h4>
	<div class="min-h-[50px] space-y-4 pl-4">
		{#each questions as question, qIdx (question.id)}
			<SortableQuestion
				{question}
				index={qIdx}
				sectionId={section.id}
				{sectionIndex}
				onRemove={() => removeQuestion(qIdx)}
			/>
		{/each}
		<div class="grid grid-cols-2 gap-4">
			<button
				class="flex w-[calc(100%-0.5rem)] cursor-pointer items-center justify-center gap-2 rounded border-2 border-gray-500 py-2 text-gray-700 transition hover:border-primary hover:bg-white/30 hover:text-primary"
				onclick={addQuestion}
			>
				<i class="fa-solid fa-plus"></i> Add Question
			</button>
			<button
				class="-ml-2 flex w-[calc(100%+0.5rem)] cursor-pointer items-center justify-center gap-2 rounded border-2 border-gray-500 py-2 text-gray-700 transition hover:border-primary hover:bg-white/30 hover:text-primary"
				onclick={onGenerateQuestion}
			>
				<i class="fa-solid fa-wand-magic-sparkles"></i> Generate Question
			</button>
		</div>
	</div>
</div>
