<script lang="ts">
	import HoverInfo from '$lib/components/HoverInfo.svelte';
	import { useSortable } from '@dnd-kit-svelte/svelte/sortable';
	import { CollisionPriority } from '@dnd-kit/abstract';
	import { untrack } from 'svelte';
	import SortableQuestion from './SortableQuestion.svelte';
	import { dragState } from './dragState.svelte';
	import type { GuideQuestion, GuideSection } from './types';

	interface Props {
		section: GuideSection;
		questions: GuideQuestion[];
		sectionIndex: number;
		allSections?: GuideSection[];
		allQuestions?: Record<string, GuideQuestion[]>;
		onRemove: () => void;
		onGenerateQuestion?: () => void;
		isOverlay?: boolean;
		source?: 'guide' | 'chat';
	}

	let {
		section,
		questions,
		sectionIndex,
		allSections = [],
		allQuestions = {},
		onRemove,
		onGenerateQuestion,
		isOverlay = false,
		source = 'guide'
	}: Props = $props();

	const { ref, handleRef, isDragging } = useSortable(
		untrack(() => ({
			id: section.id,
			index: () => sectionIndex,
			type: 'section',
			data: {
				type: 'section',
				section,
				questions,
				source
			},
			accept: ['question', 'section'],
			collisionPriority: CollisionPriority.Low
		}))
	);

	let chatDropTarget = $derived(
		dragState.chatDropTarget?.id === section.id ? dragState.chatDropTarget : null
	);

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
	class="group relative rounded-lg border border-black bg-secondary p-4 transition-all duration-200"
	style:transition={(dragState.draggingType || dragState.keepTransitionsDisabled) && !isOverlay
		? 'opacity 200ms, transform 200ms, box-shadow 200ms'
		: undefined}
	class:opacity-50={isDragging.current && !isOverlay}
	class:shadow-xl={isOverlay}
	class:rotate-1={isOverlay}
	style:box-shadow={chatDropTarget && !isOverlay
		? chatDropTarget.dragType === 'section'
			? chatDropTarget.position === 'before'
				? '0 -3px 0 0 var(--color-primary)'
				: '0 3px 0 0 var(--color-primary)'
			: '0 3px 0 0 var(--color-primary)'
		: undefined}
	style:max-height={dragState.draggingType === 'section' && !isOverlay ? '19rem' : 'none'}
	style:overflow={dragState.draggingType === 'section' && !isOverlay ? 'hidden' : 'visible'}
	{@attach ref}
>
	<!-- Section Header/Controls -->
	<div class="mb-4 flex items-start justify-between">
		<div class="flex items-center gap-2">
			<span class="font-bold text-black">Section {sectionIndex + 1}</span>
			<div
				class="cursor-grab rounded px-1 text-gray-800 outline-none hover:bg-white/50"
				title="Move Section"
				{@attach handleRef}
			>
				<i class="fa-solid fa-grip"></i>
			</div>
		</div>
		<button
			class="cursor-pointer rounded p-2 text-gray-700 transition hover:text-red-500"
			onclick={onRemove}
			aria-label="Remove section"
		>
			<i class="fa-solid fa-trash"></i>
		</button>
	</div>

	<div class="mb-4">
		<label class="mb-1 block text-sm font-bold text-gray-700">
			Description
			<textarea
				autocomplete="off"
				class="h-22 w-full resize-y rounded-md border-gray-200 bg-gray-50 p-3 text-sm font-medium transition-colors focus:border-primary focus:bg-white focus:ring-primary/20"
				bind:value={section.description}
			></textarea>
		</label>
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
				{allSections}
				{allQuestions}
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

	<div class="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 pl-4">
		<div class="flex items-center gap-3">
			<label class="text-sm font-medium text-gray-700" for="ai-generated-questions-{section.id}">
				AI Generated Questions
			</label>
			<input
				id="ai-generated-questions-{section.id}"
				type="number"
				min="0"
				class="w-20 rounded-md border border-gray-300 p-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary"
				bind:value={section.ai_generated_questions.n}
			/>
			<HoverInfo
				text="Specifies the number of questions that will be automatically generated once the predefined ones are finished."
			/>
		</div>
		{#if section.ai_generated_questions.n > 0}
			<div class="flex items-center gap-3">
				<label
					class="text-sm font-medium text-gray-700"
					for="ai-generated-max-probes-n-{section.id}"
				>
					Max Probes
				</label>
				<input
					id="ai-generated-max-probes-n-{section.id}"
					type="number"
					min="0"
					class="w-20 rounded-md border border-gray-300 p-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary"
					bind:value={section.ai_generated_questions.max_probes_n}
				/>
				<HoverInfo text="Maximum number of follow-up probes for each AI-generated question." />
			</div>
			<div class="flex items-center gap-3">
				<label
					class="text-sm font-medium text-gray-700"
					for="ai-generated-max-probes-time-{section.id}"
				>
					Time probing (seconds)
				</label>
				<input
					id="ai-generated-max-probes-time-{section.id}"
					type="number"
					min="0"
					class="w-20 rounded-md border border-gray-300 p-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary"
					bind:value={section.ai_generated_questions.max_probes_time}
				/>
				<HoverInfo text="Maximum time (in seconds) spent probing each AI-generated question." />
			</div>
		{/if}
	</div>
</div>
