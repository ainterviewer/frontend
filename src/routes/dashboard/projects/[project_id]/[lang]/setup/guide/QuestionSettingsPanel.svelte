<script lang="ts">
	import HoverInfo from '$lib/components/HoverInfo.svelte';
	import { createListReorder } from './listReorder.svelte';
	import type { GuideQuestion } from './types';

	interface Props {
		question: GuideQuestion;
		dataTour?: string;
		onAddImage: () => void;
		onAddSurvey: () => void;
		onAddCondition: () => void;
	}

	let { question, dataTour, onAddImage, onAddSurvey, onAddCondition }: Props = $props();

	const probeReorder = createListReorder(() => question.probes, '[data-probe-row]');
</script>

<!-- Add buttons for Image/Survey/Condition -->
<div data-tour={dataTour ? 'question-extras' : undefined} class="space-y-4">
	{#if !question.image || !question.survey_item || !question.conditions}
		<div class="flex flex-wrap gap-4">
			{#if !question.image}
				<button
					class="flex items-center gap-2 rounded border border-gray-400 px-2 py-1 text-sm font-medium text-gray-600 transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
					onclick={onAddImage}
				>
					<i class="fa-solid fa-image text-sky-600"></i> Add Image
				</button>
			{/if}
			{#if !question.survey_item}
				<button
					class="flex items-center gap-2 rounded border border-gray-400 px-2 py-1 text-sm font-medium text-gray-600 transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
					onclick={onAddSurvey}
				>
					<i class="fa-solid fa-square-poll-horizontal text-indigo-500"></i> Add Survey Item
				</button>
			{/if}
			{#if !question.conditions}
				<button
					class="flex items-center gap-2 rounded border border-gray-400 px-2 py-1 text-sm font-medium text-gray-600 transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
					onclick={onAddCondition}
				>
					<i class="fa-solid fa-code-branch text-amber-600"></i> Add Condition
				</button>
			{/if}
		</div>
	{/if}
</div>

<!-- Alternative Main Questions -->
<div class="hidden">
	<span class="mb-2 block text-xs font-bold tracking-wider text-gray-700 uppercase"
		>Alternative Phrasings</span
	>
	{#if question.alternative_main_questions}
		<div class="mb-2 space-y-2">
			{#each question.alternative_main_questions as _, aqIdx (aqIdx)}
				<div class="flex gap-2">
					<input
						autocomplete="off"
						class="flex-1 rounded border-gray-200 p-2 text-sm shadow-sm focus:border-primary focus:ring-primary/20"
						bind:value={question.alternative_main_questions[aqIdx]}
						placeholder="Another way to ask this..."
					/>
					<button
						class="px-2 text-gray-400 hover:text-red-500"
						onclick={() => question.alternative_main_questions?.splice(aqIdx, 1)}
						aria-label="Remove alternative question"><i class="fa-solid fa-trash"></i></button
					>
				</div>
			{/each}
		</div>
	{/if}
	<button
		class="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/5 hover:text-primary/80"
		onclick={() => {
			if (!question.alternative_main_questions) question.alternative_main_questions = [];
			question.alternative_main_questions.push('');
		}}
	>
		<i class="fa-solid fa-plus"></i> Add Alternative
	</button>
</div>

<!-- Probes -->
<div data-tour={dataTour ? 'probes' : undefined}>
	<span class="mb-2 block text-xs font-bold tracking-wider text-gray-700 uppercase"
		>Follow-up Probes</span
	>
	{#if question.probes}
		<div class="mb-2 space-y-2">
			{#each question.probes as _, pIdx (pIdx)}
				<div
					data-probe-row
					class="flex items-center gap-2 transition-opacity"
					class:opacity-40={probeReorder.draggedIndex === pIdx}
					ondragover={(e) => probeReorder.dragOver(e, pIdx)}
					role="listitem"
				>
					<div
						class="cursor-grab rounded p-1 text-gray-600 outline-none hover:text-gray-800"
						title="Reorder probe"
						draggable="true"
						ondragstart={(e) => probeReorder.dragStart(e, pIdx)}
						ondragend={probeReorder.dragEnd}
						role="button"
						tabindex="-1"
						aria-label="Reorder probe"
					>
						<i class="fa-solid fa-grip-vertical"></i>
					</div>
					<input
						autocomplete="off"
						class="flex-1 rounded border-gray-200 p-2 text-sm shadow-sm focus:border-primary focus:ring-primary/20"
						bind:value={question.probes[pIdx]}
						placeholder="Follow-up question if needed..."
					/>
					<button
						class="px-2 text-gray-400 hover:text-red-500"
						onclick={() => question.probes?.splice(pIdx, 1)}
						aria-label="Remove probe"><i class="fa-solid fa-trash"></i></button
					>
				</div>
			{/each}
		</div>
	{/if}
	<button
		class="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/5 hover:text-primary/80"
		onclick={() => {
			if (!question.probes) question.probes = [];
			question.probes.push('');
		}}
	>
		<i class="fa-solid fa-plus"></i> Add Probe
	</button>
</div>

<!-- Configuration Grid -->
<div class="grid grid-cols-1 gap-20 border-t border-gray-200 pt-4 sm:grid-cols-3">
	<!-- Probing Limits -->
	<div data-tour={dataTour ? 'probing-limits' : undefined} class="space-y-3">
		<span class="text-xs font-bold tracking-wider text-gray-700 uppercase">Probing Limits</span>
		<div class="mt-2 space-y-2">
			<div class="flex items-center justify-between">
				<span class="text-sm text-gray-700">Max Probes</span>
				<input
					type="number"
					min="0"
					class="w-16 rounded border-gray-200 p-1 text-sm focus:border-primary focus:ring-primary/20"
					bind:value={question.max_probes_n}
				/>
			</div>
			<div class="flex items-center justify-between">
				<span class="text-sm text-gray-700">Max Time (seconds)</span>
				<input
					type="number"
					min="0"
					class="w-16 rounded border-gray-200 p-1 text-sm focus:border-primary focus:ring-primary/20"
					bind:value={question.max_probes_time}
				/>
			</div>
		</div>
	</div>

	<!-- Behavior Flags -->
	<div data-tour={dataTour ? 'behavior-flags' : undefined} class="col-span-2 space-y-3">
		<span class="text-xs font-bold tracking-wider text-gray-700 uppercase">Behavior Flags</span>
		<div class="mt-2 grid grid-cols-2 gap-x-4 gap-y-3">
			<div class="flex">
				<label
					class="flex cursor-pointer items-center gap-2 text-sm text-gray-700 transition-colors hover:text-primary"
				>
					<input
						type="checkbox"
						class="rounded border-gray-300 text-primary focus:ring-primary"
						bind:checked={question.exclude_from_history}
					/>
					Exclude from history
				</label>
				<HoverInfo
					class="ml-2"
					iconColor="gray-500"
					text="Excludes the question from the conversation history. This means that the AInterviewer doesn't have access to the information from this question when asking other questions."
				></HoverInfo>
			</div>
			<div class="flex">
				<label
					class="flex cursor-pointer items-center gap-2 text-sm text-gray-700 transition-colors hover:text-primary"
				>
					<input
						type="checkbox"
						class="rounded border-gray-300 text-primary focus:ring-primary"
						bind:checked={question.create_segue}
					/>
					Create transition
				</label>
				<HoverInfo
					class="ml-2"
					iconColor="gray-500"
					text="Reformulates the main question to include a transition from the previous question to the current."
				></HoverInfo>
			</div>
			<div class="flex">
				<label
					class="flex cursor-pointer items-center gap-2 text-sm text-gray-700 transition-colors hover:text-primary"
				>
					<input
						type="checkbox"
						class="rounded border-gray-300 text-primary focus:ring-primary"
						bind:checked={question.check_if_answered}
					/>
					Check if answered
				</label>
				<HoverInfo
					class="ml-2"
					iconColor="gray-500"
					text="Checks is the question has already been answered. If it has, the main question will be reformulated to take the previous answers into acocunt."
				></HoverInfo>
			</div>
			<div class="flex">
				<label
					class="flex cursor-pointer items-center gap-2 text-sm text-gray-700 transition-colors hover:text-primary"
				>
					<input
						type="checkbox"
						class="rounded border-gray-300 text-primary focus:ring-primary"
						bind:checked={question.check_if_exhausted}
					/>
					Check if exhausted
				</label>
				<HoverInfo
					class="ml-2"
					iconColor="gray-500"
					text="Checks during probing if the question has been exhausted, based on the provided context."
				></HoverInfo>
			</div>
			<div class="flex">
				<label
					class="flex cursor-pointer items-center gap-2 text-sm text-gray-700 transition-colors hover:text-primary"
				>
					<input
						type="checkbox"
						class="rounded border-gray-300 text-primary focus:ring-primary"
						bind:checked={question.can_answer}
					/>
					Can answer
				</label>
				<HoverInfo
					class="ml-2"
					iconColor="gray-500"
					text="If the user can answer; use to send multiple messages in a row while not allowing the user to answer in between."
				></HoverInfo>
			</div>
			<div class="flex">
				<label
					class="flex cursor-pointer items-center gap-2 text-sm text-gray-700 transition-colors hover:text-primary"
				>
					<input
						type="checkbox"
						class="rounded border-gray-300 text-primary focus:ring-primary"
						bind:checked={question.can_skip}
					/>
					Can skip
				</label>
				<HoverInfo
					class="ml-2"
					iconColor="gray-500"
					text="If the user should be presented with a 'Skip' button when hovering the question."
				></HoverInfo>
			</div>
			<div class="flex hidden">
				<label
					class="flex cursor-pointer items-center gap-2 text-sm text-gray-700 transition-colors hover:text-primary"
				>
					<input
						type="checkbox"
						class="rounded border-gray-300 text-primary focus:ring-primary"
						bind:checked={question.user_image}
					/>
					User image
				</label>
				<HoverInfo
					class="ml-2"
					iconColor="gray-500"
					text="If the user should be able to reply with an image"
				></HoverInfo>
			</div>
			<div class="flex">
				<label
					class="flex cursor-pointer items-center gap-2 text-sm text-gray-700 transition-colors hover:text-primary"
				>
					<input
						type="checkbox"
						class="rounded border-gray-300 text-primary focus:ring-primary"
						bind:checked={question.shuffle}
					/>
					Shuffle question
				</label>
				<HoverInfo
					class="ml-2"
					iconColor="gray-500"
					text="If the order of this question should be randomly shuffled. There must be multiple questions in the same section with this toggled for it to have an effect."
				></HoverInfo>
			</div>
		</div>
	</div>
</div>
