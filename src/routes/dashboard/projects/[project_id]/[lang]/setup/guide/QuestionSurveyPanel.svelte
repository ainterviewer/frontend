<script lang="ts">
	import HoverInfo from '$lib/components/HoverInfo.svelte';
	import MessageBubble from '$lib/components/interview/MessageBubble.svelte';
	import SurveyItem from '$lib/components/interview/SurveyItem.svelte';
	import type { SurveyItemUnion } from '$lib/components/interview/types';
	import { getGuideStore } from '$lib/stores/guideStore.svelte';

	import AccordionPanel from './AccordionPanel.svelte';
	import { createListReorder } from './listReorder.svelte';
	import { pick, surveyItemOptions } from './localized';
	import { renderSurveyItem } from './render';
	import TextField from './TextField.svelte';
	import type { GuideQuestion } from './types';

	interface Props {
		question: GuideQuestion;
		expanded?: boolean;
	}

	let { question, expanded = $bindable(false) }: Props = $props();

	// A fresh option. Options keep their id across languages and reordering;
	// conditions name them by it.
	function option() {
		return { id: crypto.randomUUID(), text: {} };
	}

	const guideStore = getGuideStore();

	// The item as a respondent in the language being edited would get it,
	// untranslated text falling back to the default language like the server's.
	let previewItem = $derived(
		renderSurveyItem(question.survey_item, guideStore.languages) as SurveyItemUnion | null
	);

	let previewQuestion = $derived(pick(question.main_question, guideStore.languages));

	const optionReorder = createListReorder(
		() => surveyItemOptions(question.survey_item),
		'[data-option-row]'
	);
</script>

{#if question.survey_item}
	{@const surveyItem = question.survey_item}
	<AccordionPanel
		borderColor="border-l-indigo-500"
		bind:expanded
		removeTitle="Remove Survey Item"
		onremove={() => {
			question.survey_item = null;
			expanded = false;
		}}
	>
		{#snippet header()}
			<div
				class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-indigo-50 text-indigo-500"
			>
				<i class="fa-solid fa-square-poll-horizontal text-lg"></i>
			</div>
			<div class="min-w-0 flex-1 text-left">
				<div class="font-medium text-gray-700">Survey Item</div>
				<div class="text-xs text-gray-500">
					{surveyItem.type === 'number' ||
					surveyItem.type === 'date' ||
					surveyItem.type === 'datetime' ||
					surveyItem.type === 'time' ||
					surveyItem.type === 'slider'
						? surveyItem.type
						: `${surveyItemOptions(surveyItem)?.length ?? 0} options (${surveyItem.type})`}
				</div>
			</div>
		{/snippet}

		<div class="flex flex-col gap-6 xl:flex-row xl:items-start xl:gap-8">
			<div class="w-full max-w-sm shrink-0 space-y-4 p-2 text-sm xl:pr-0">
				<label class="mb-2 block text-gray-500">
					Type
					<select
						class="mt-1 w-full rounded border-gray-200 bg-gray-50 p-1.5 text-sm focus:border-primary focus:ring-primary/20"
						value={surveyItem.type}
						onchange={(e) => {
							const type = (e.target as HTMLSelectElement).value;
							if (type === 'radio' || type === 'checkbox') {
								question.survey_item = { type, options: [option()] };
							} else if (type === 'likert') {
								question.survey_item = { type, options: [option()] };
							} else if (type === 'slider') {
								question.survey_item = { type, min: 0, max: 10, min_label: {}, max_label: {} };
							} else if (type === 'number') {
								question.survey_item = { type };
							} else if (type === 'date') {
								question.survey_item = { type };
							} else if (type === 'datetime') {
								question.survey_item = { type };
							} else if (type === 'time') {
								question.survey_item = { type };
							}
						}}
					>
						<option value="radio">Single Choice</option>
						<option value="checkbox">Multiple Choice</option>
						<option value="likert">Likert Scale</option>
						<option value="slider">Slider</option>
						<option value="number">Number</option>
						<option value="date">Date</option>
						<option value="datetime">Date & Time</option>
						<option value="time">Time</option>
					</select>
				</label>
				{#if surveyItem.type === 'radio' || surveyItem.type === 'checkbox' || surveyItem.type === 'likert'}
					<div>
						<span class="mb-2 block text-gray-500">Options</span>
						<div class="space-y-1">
							{#each surveyItem.options as surveyOption, oIdx (surveyOption.id ?? oIdx)}
								<div
									data-option-row
									class="flex items-center gap-1 transition-opacity"
									class:opacity-40={optionReorder.draggedIndex === oIdx}
									ondragover={(e) => optionReorder.dragOver(e, oIdx)}
									role="listitem"
								>
									<div
										class="cursor-grab rounded p-1 text-gray-400 outline-none hover:bg-gray-100 hover:text-gray-600"
										title="Reorder option"
										draggable="true"
										ondragstart={(e) => optionReorder.dragStart(e, oIdx)}
										ondragend={optionReorder.dragEnd}
										role="button"
										tabindex="-1"
										aria-label="Reorder option"
									>
										<i class="fa-solid fa-grip-vertical"></i>
									</div>
									<TextField
										class="flex-1 rounded border-gray-200 p-1.5 text-sm focus:border-primary focus:ring-primary/20"
										text={surveyOption.text!}
										placeholder={`Option ${oIdx + 1}`}
									/>
									<button
										class="px-1 text-gray-400 hover:text-red-500"
										onclick={() => surveyItem.options.splice(oIdx, 1)}
										title="Remove Survey Option"><i class="fa-solid fa-trash"></i></button
									>
								</div>
							{/each}
							<button
								class="mt-1 text-sm font-medium text-primary hover:underline"
								onclick={() => surveyItem.options.push(option())}>+ Add Option</button
							>
						</div>
					</div>
				{/if}
				{#if surveyItem.type === 'radio' || surveyItem.type === 'checkbox'}
					<label
						class="mt-1 flex cursor-pointer items-center gap-2 text-sm text-gray-700 transition-colors hover:text-primary"
					>
						<input
							type="checkbox"
							class="rounded border-gray-300 text-primary focus:ring-primary"
							bind:checked={surveyItem.with_other}
						/>
						Include "Other" option
						<HoverInfo
							iconColor="gray-500"
							text="Include and 'Other' option that allows the user to input their own answer."
						></HoverInfo>
					</label>
				{/if}
				{#if surveyItem.type === 'likert'}
					<label class="mb-2 block text-gray-500">
						Display as
						<select
							class="mt-1 w-full rounded border-gray-200 bg-gray-50 p-1.5 text-sm focus:border-primary focus:ring-primary/20"
							bind:value={surveyItem.ui}
						>
							<option value="radio">Radio buttons</option>
							<option value="slider">Slider</option>
						</select>
					</label>
				{/if}
				{#if surveyItem.type === 'number'}
					<div class="grid grid-cols-3 gap-2">
						<label class="mb-2 block text-sm text-gray-500">
							Min
							<input
								type="number"
								class="mt-1 w-full rounded border-gray-200 p-1.5 text-sm focus:border-primary focus:ring-primary/20"
								placeholder="No min"
								bind:value={surveyItem.min}
							/>
						</label>
						<label class="mb-2 block text-sm text-gray-500">
							Max
							<input
								type="number"
								class="mt-1 w-full rounded border-gray-200 p-1.5 text-sm focus:border-primary focus:ring-primary/20"
								placeholder="No max"
								bind:value={surveyItem.max}
							/>
						</label>
						<label class="mb-2 block text-sm text-gray-500">
							Step
							<input
								type="number"
								class="mt-1 w-full rounded border-gray-200 p-1.5 text-sm focus:border-primary focus:ring-primary/20"
								placeholder="No step"
								bind:value={surveyItem.step}
							/>
						</label>
					</div>
				{/if}
				{#if surveyItem.type === 'slider'}
					<div class="grid grid-cols-2 gap-2">
						<label class="mb-2 block text-sm text-gray-500">
							Min Label
							<TextField
								class="mt-1 w-full rounded border-gray-200 p-1.5 text-sm focus:border-primary focus:ring-primary/20"
								placeholder="Min label..."
								text={surveyItem.min_label!}
							/>
						</label>
						<label class="mb-2 block text-sm text-gray-500">
							Max Label
							<TextField
								class="mt-1 w-full rounded border-gray-200 p-1.5 text-sm focus:border-primary focus:ring-primary/20"
								placeholder="Max label..."
								text={surveyItem.max_label!}
							/>
						</label>
					</div>
					<div class="grid grid-cols-3 gap-2">
						<label class="mb-2 block text-sm text-gray-500">
							Min
							<input
								type="number"
								class="mt-1 w-full rounded border-gray-200 p-1.5 text-sm focus:border-primary focus:ring-primary/20"
								placeholder="No min"
								bind:value={surveyItem.min}
							/>
						</label>
						<label class="mb-2 block text-sm text-gray-500">
							Max
							<input
								type="number"
								class="mt-1 w-full rounded border-gray-200 p-1.5 text-sm focus:border-primary focus:ring-primary/20"
								placeholder="No max"
								bind:value={surveyItem.max}
							/>
						</label>
						<label class="mb-2 block text-sm text-gray-500">
							Step
							<input
								type="number"
								class="mt-1 w-full rounded border-gray-200 p-1.5 text-sm focus:border-primary focus:ring-primary/20"
								placeholder="No step"
								bind:value={surveyItem.step}
							/>
						</label>
					</div>
				{/if}
				{#if surveyItem.type === 'date'}
					<div class="grid grid-cols-2 gap-2">
						<label class="mb-2 block text-sm text-gray-500">
							Min
							<input
								type="date"
								class="mt-1 w-full rounded border-gray-200 p-1.5 text-sm focus:border-primary focus:ring-primary/20"
								bind:value={surveyItem.min}
							/>
						</label>
						<label class="mb-2 block text-sm text-gray-500">
							Max
							<input
								type="date"
								class="mt-1 w-full rounded border-gray-200 p-1.5 text-sm focus:border-primary focus:ring-primary/20"
								bind:value={surveyItem.max}
							/>
						</label>
					</div>
				{/if}
				{#if surveyItem.type === 'datetime'}
					<div class="grid grid-cols-2 gap-2">
						<label class="mb-2 block text-sm text-gray-500">
							Min
							<input
								type="datetime-local"
								class="mt-1 w-full rounded border-gray-200 p-1.5 text-sm focus:border-primary focus:ring-primary/20"
								bind:value={surveyItem.min}
							/>
						</label>
						<label class="mb-2 block text-sm text-gray-500">
							Max
							<input
								type="datetime-local"
								class="mt-1 w-full rounded border-gray-200 p-1.5 text-sm focus:border-primary focus:ring-primary/20"
								bind:value={surveyItem.max}
							/>
						</label>
					</div>
				{/if}
				{#if surveyItem.type === 'time'}
					<div class="grid grid-cols-2 gap-2">
						<label class="mb-2 block text-sm text-gray-500">
							Min
							<input
								type="time"
								class="mt-1 w-full rounded border-gray-200 p-1.5 text-sm focus:border-primary focus:ring-primary/20"
								bind:value={surveyItem.min}
							/>
						</label>
						<label class="mb-2 block text-sm text-gray-500">
							Max
							<input
								type="time"
								class="mt-1 w-full rounded border-gray-200 p-1.5 text-sm focus:border-primary focus:ring-primary/20"
								bind:value={surveyItem.max}
							/>
						</label>
					</div>
				{/if}
			</div>
			{#if previewItem}
				<div
					class="flex min-w-0 flex-1 flex-col xl:self-stretch xl:border-l xl:border-gray-200 xl:py-2 xl:pr-8 xl:pl-8"
				>
					<div class="mb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase">
						Preview
						<span class="font-normal tracking-normal normal-case"> — as respondents see it</span>
					</div>
					<!-- Laid out like the respondent's chat: the question from the
					     interviewer on the left, the item to answer on the right. -->
					{#if previewQuestion}
						<div class="mb-3">
							<MessageBubble
								interviewer
								compact
								text={previewQuestion}
								lang={guideStore.lang.toUpperCase()}
							/>
						</div>
					{/if}
					<div class="ml-auto w-full max-w-md">
						<!-- Re-mount on a type change: the answer state of one type is
					     meaningless, and can be out of range, for another. -->
						{#key `${previewItem.type}-${'ui' in previewItem ? previewItem.ui : ''}`}
							<SurveyItem {...previewItem} lang={guideStore.lang.toUpperCase()} preview />
						{/key}
					</div>
				</div>
			{/if}
		</div>
	</AccordionPanel>
{/if}
