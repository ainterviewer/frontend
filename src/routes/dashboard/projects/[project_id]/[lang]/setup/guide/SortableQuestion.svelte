<script lang="ts">
	import { useSortable } from '@dnd-kit-svelte/svelte/sortable';
	import { untrack } from 'svelte';
	import { slide } from 'svelte/transition';
	import { dragState } from './dragState.svelte';
	import QuestionConditionsPanel from './QuestionConditionsPanel.svelte';
	import QuestionImagePanel from './QuestionImagePanel.svelte';
	import QuestionSettingsPanel from './QuestionSettingsPanel.svelte';
	import QuestionSurveyPanel from './QuestionSurveyPanel.svelte';
	import type { GuideQuestion, GuideSection } from './types';

	interface Props {
		question: GuideQuestion;
		sectionId: string;
		sectionIndex: number;
		index: number;
		allSections?: GuideSection[];
		allQuestions?: Record<string, GuideQuestion[]>;
		onRemove: () => void;
		isOverlay?: boolean;
		source?: 'guide' | 'chat';
		dataTour?: string;
	}

	let {
		question,
		sectionId,
		sectionIndex,
		index,
		allSections = [],
		allQuestions = {},
		onRemove,
		isOverlay = false,
		source = 'guide',
		dataTour
	}: Props = $props();

	let showSettings = $state(false);
	let expandedImage = $state(false);
	let expandedSurvey = $state(false);
	let expandedCondition = $state(false);

	let settingsPanel = $state<HTMLDivElement | null>(null);

	function toggleSettings() {
		showSettings = !showSettings;
		if (!showSettings) return;
		// The action bar floats (sticky) at the bottom of the scroll container, so a
		// freshly opened settings panel can end up partly hidden behind it. Once the
		// slide-open transition (200ms) has settled, scroll the panel up just enough
		// for its bottom to clear the bar.
		setTimeout(() => {
			const panel = settingsPanel;
			const scroller = panel?.closest('main');
			if (!panel || !scroller) return;
			const bar = scroller.querySelector<HTMLElement>('[data-action-bar]');
			const barClearance = (bar?.offsetHeight ?? 72) + 56;
			const overflow =
				panel.getBoundingClientRect().bottom -
				(scroller.getBoundingClientRect().bottom - barClearance);
			if (overflow > 0) {
				scroller.scrollBy({ top: overflow, behavior: 'smooth' });
			}
		}, 220);
	}

	const { ref, handleRef, isDragging } = useSortable(
		untrack(() => ({
			id: question.id,
			index: () => index,
			group: sectionId,
			type: 'question',
			accept: 'question',
			data: {
				type: 'question',
				question,
				sectionId,
				source
			}
		}))
	);

	let chatTargetInfo = $derived(
		dragState.chatDropTarget?.id === question.id ? dragState.chatDropTarget : null
	);

	function addImage() {
		question.image = { description: '', alt: '', name: '', data: null };
		expandedImage = true;
	}

	function addSurvey() {
		question.survey_item = { type: 'radio', options: ['Option 1'] };
		expandedSurvey = true;
	}

	function addCondition() {
		// Default the target to the very first question, which is always at or
		// before the current one (and always exists, since this question does).
		const firstSection = allSections[0];
		const defaultSectionId = firstSection?.id ?? sectionId;
		const defaultQuestionId = firstSection
			? (allQuestions[firstSection.id]?.[0]?.id ?? question.id)
			: question.id;
		question.conditions = {
			action: 'skip_question',
			conditions: [
				{
					trigger_type: 'match',
					negated: false,
					evaluation: [
						{
							trigger_value: '',
							comparison_operator: '=='
						}
					],
					question_context: {
						sectionId: defaultSectionId,
						questionId: defaultQuestionId,
						part: 'main'
					}
				}
			]
		};
		expandedCondition = true;
	}
</script>

<div
	data-tour={dataTour}
	id={question.id}
	class="group relative scroll-mt-24 rounded-lg border border-black bg-secondary p-5 brightness-105 transition-all duration-200 hover:shadow-md"
	style:transition={(dragState.draggingType || dragState.keepTransitionsDisabled) && !isOverlay
		? 'opacity 200ms, transform 200ms, box-shadow 200ms'
		: undefined}
	class:opacity-50={isDragging.current && !isOverlay}
	class:shadow-xl={isOverlay}
	class:scale-[1.02]={isOverlay}
	class:rotate-1={isOverlay}
	class:border-l-4={!isOverlay}
	class:border-l-primary={!isOverlay}
	style:box-shadow={chatTargetInfo && !isOverlay
		? chatTargetInfo.position === 'before'
			? '0 -3px 0 0 var(--color-primary)'
			: '0 3px 0 0 var(--color-primary)'
		: undefined}
	style:max-height={dragState.draggingType === 'question' && !isOverlay ? '19rem' : 'none'}
	style:overflow={dragState.draggingType === 'question' && !isOverlay ? 'hidden' : 'visible'}
	{@attach ref}
>
	<!-- Header with Drag Handle and Actions -->
	<div class="mb-4 flex items-start justify-between">
		<div class="flex items-center gap-2">
			<span class="font-bold text-black">Question {sectionIndex + 1}.{index + 1}</span>
			<div
				class="cursor-grab rounded p-1 text-gray-800 outline-none hover:bg-white/50"
				title="Move Question"
				{@attach handleRef}
			>
				<i class="fa-solid fa-grip-vertical text-lg"></i>
			</div>
		</div>

		<div class="flex gap-2">
			<button
				data-tour={dataTour ? 'question-settings' : undefined}
				class="cursor-pointer rounded-md p-1.5 text-gray-700 transition-colors hover:text-primary"
				onclick={toggleSettings}
				title={showSettings ? 'Hide Settings' : 'Show Settings'}
			>
				Settings
				<i class="fa-solid fa-gear ml-1" class:text-primary={showSettings}></i>
			</button>
			<button
				class="cursor-pointer rounded-md p-1.5 text-gray-700 transition-colors hover:text-red-500"
				onclick={onRemove}
				title="Remove Question"
			>
				<i class="fa-solid fa-trash"></i>
			</button>
		</div>
	</div>

	<div class="space-y-4">
		<!-- Main Content -->
		<div>
			<label class="mb-1 block text-xs font-bold tracking-wider text-gray-700 uppercase">
				Description
				<textarea
					autocomplete="off"
					class="mt-1 h-22 w-full resize-y rounded-md border-gray-200 bg-gray-50 p-3 text-sm font-medium tracking-normal normal-case transition-colors focus:border-primary focus:bg-white focus:ring-primary/20"
					placeholder="Add some context or description..."
					bind:value={question.description}
				></textarea>
			</label>
		</div>

		<div>
			<label class="mb-1 block text-xs font-bold tracking-wider text-gray-700 uppercase">
				Main Question
				<textarea
					autocomplete="off"
					class="mt-1 h-18 w-full resize-y rounded-md border-gray-200 bg-gray-50 p-3 text-sm font-medium tracking-normal normal-case transition-colors focus:border-primary focus:bg-white focus:ring-primary/20"
					placeholder="What would you like to ask?"
					bind:value={question.main_question}
				></textarea>
			</label>
		</div>

		<!-- Accordion Panels for Image/Survey/Condition -->
		{#if question.image || question.survey_item || question.conditions}
			<div class="flex flex-wrap gap-2 pt-2">
				<QuestionImagePanel {question} bind:expanded={expandedImage} />
				<QuestionSurveyPanel {question} bind:expanded={expandedSurvey} />
				<QuestionConditionsPanel
					{question}
					{sectionIndex}
					{index}
					{allSections}
					{allQuestions}
					bind:expanded={expandedCondition}
				/>
			</div>
		{/if}

		<!-- Collapsible Settings -->
		{#if showSettings}
			<div
				bind:this={settingsPanel}
				data-tour={dataTour ? 'question-settings-menu' : undefined}
				transition:slide={{ duration: 200 }}
				class="-mx-5 space-y-6 border-t border-gray-100 bg-gray-50/30 px-5 pt-4 pb-4"
			>
				<QuestionSettingsPanel
					{question}
					{dataTour}
					onAddImage={addImage}
					onAddSurvey={addSurvey}
					onAddCondition={addCondition}
				/>
			</div>
		{/if}
	</div>
</div>
