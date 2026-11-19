<script lang="ts">
	import type { GuideQuestion } from '$lib/guide/types';

	import FlagToggle from './FlagToggle.svelte';

	interface Props {
		question: GuideQuestion;
		dataTour?: string;
		/** Whether the card already shows the Probing panel. */
		probingShown: boolean;
		onAddImage: () => void;
		onAddSurvey: () => void;
		onAddCondition: () => void;
		onAddProbing: () => void;
	}

	let {
		question,
		dataTour,
		probingShown,
		onAddImage,
		onAddSurvey,
		onAddCondition,
		onAddProbing
	}: Props = $props();

	const addButton =
		'flex items-center gap-2 rounded border border-gray-400 px-2 py-1 text-sm font-medium text-gray-600 transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary';
</script>

<!-- Add buttons for Image/Survey/Condition/Probing -->
<div data-tour={dataTour ? 'question-extras' : undefined} class="space-y-4">
	{#if !question.image || !question.survey_item || question.conditions.length === 0 || !probingShown}
		<div class="flex flex-wrap gap-4">
			{#if !question.image}
				<button class={addButton} onclick={onAddImage}>
					<i class="fa-solid fa-image text-sky-600"></i> Add Image
				</button>
			{/if}
			{#if !question.survey_item}
				<button class={addButton} onclick={onAddSurvey}>
					<i class="fa-solid fa-square-poll-horizontal text-indigo-500"></i> Add Survey Item
				</button>
			{/if}
			{#if question.conditions.length === 0}
				<button class={addButton} onclick={onAddCondition}>
					<i class="fa-solid fa-code-branch text-amber-600"></i> Add Condition
				</button>
			{/if}
			{#if !probingShown}
				<button class={addButton} onclick={onAddProbing}>
					<i class="fa-solid fa-comments text-violet-600"></i> Add Probing
				</button>
			{/if}
		</div>
	{/if}
</div>

<!-- Behavior Flags -->
<div data-tour={dataTour ? 'behavior-flags' : undefined} class="space-y-3 border-t border-gray-200">
	<span class="text-xs font-bold tracking-wider text-gray-700 uppercase">Behavior Flags</span>
	<div class="mt-2 grid grid-cols-1 gap-x-20 gap-y-3 sm:grid-cols-[repeat(2,max-content)]">
		<FlagToggle
			label="Exclude from history"
			info="Excludes the question from the conversation history. This means that the AInterviewer doesn't have access to the information from this question when asking other questions."
			bind:checked={question.exclude_from_history}
		/>
		<FlagToggle
			label="Create transition"
			info="Reformulates the main question to include a transition from the previous question to the current."
			bind:checked={question.create_segue}
		/>
		<FlagToggle
			label="Reformulate if answered"
			info="Checks if the question has already been answered. If it has, the main question will be reformulated to take the previous answers into account."
			bind:checked={question.check_if_answered}
		/>
		<FlagToggle
			label="Can answer"
			info="Turn off to show this as a message the interviewee can't reply to, then move straight on to the next question. Use it to send several messages in a row."
			bind:checked={question.can_answer}
		/>
		<FlagToggle
			label="Can skip"
			info="If the user should be presented with a 'Skip' button when hovering the question."
			bind:checked={question.can_skip}
		/>
		<FlagToggle
			label="Shuffle question"
			info="If the order of this question should be randomly shuffled. There must be multiple questions in the same section with this toggled for it to have an effect."
			bind:checked={question.shuffle}
		/>
		<div class="hidden">
			<FlagToggle
				label="User image"
				info="If the user should be able to reply with an image."
				bind:checked={question.user_image}
			/>
		</div>
	</div>
</div>
