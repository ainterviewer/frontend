<script lang="ts">
	import HoverInfo from '$lib/components/HoverInfo.svelte';
	import MessageBubble from '$lib/components/interview/MessageBubble.svelte';
	import SurveyItem from '$lib/components/interview/SurveyItem.svelte';
	import type { SurveyItemUnion } from '$lib/components/interview/types';
	import { pick, surveyItemOptions } from '$lib/guide/localized';
	import { renderSurveyItem } from '$lib/guide/render';
	import type { GuideQuestion } from '$lib/guide/types';
	import { getGuideStore } from '$lib/stores/guideStore.svelte';

	import AccordionPanel from './AccordionPanel.svelte';
	import { createListReorder } from './listReorder.svelte';
	import TextField from './TextField.svelte';

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

	// A fresh row of a grid. Rows keep their id across languages and
	// reordering; the answer is keyed by it.
	function row() {
		return { id: crypto.randomUUID(), text: {}, required: true };
	}

	// Switch the item to `type`, keeping what the new type can use: the
	// options between the choice types (with their ids, so conditions naming
	// them still hold), the range between slider and number, and the range
	// between date and date & time, converted to the new format.
	function changeType(type: string) {
		const prev = $state.snapshot(question.survey_item);
		if (!prev || prev.type === type) return;
		// Booleans the API does not take as null are left out when unset: the
		// guide document writes an undefined as null, and drops a key left out.
		const base = prev.required == null ? {} : { required: prev.required };
		const options = surveyItemOptions(prev);
		const keptOptions = options?.length ? options : [option()];
		const withOther =
			'with_other' in prev && prev.with_other != null ? { with_other: prev.with_other } : {};
		const range = prev.type === 'slider' || prev.type === 'number' ? prev : null;
		const dates = prev.type === 'date' || prev.type === 'datetime' ? prev : null;
		// `YYYY-MM-DD` and `YYYY-MM-DDTHH:MM`, the inputs' own formats.
		const asDate = (v?: string | null) => v?.slice(0, 10) || null;
		const asDatetime = (v?: string | null) =>
			v ? `${v.slice(0, 10)}T${v.slice(11, 16) || '00:00'}` : null;

		if (type === 'radio' || type === 'checkbox') {
			question.survey_item = { type, ...base, options: keptOptions, ...withOther };
		} else if (type === 'likert') {
			question.survey_item = { type, ...base, options: keptOptions };
		} else if (type === 'likert_grid') {
			// The scale is the options; the rows start empty, two of them, since
			// a grid of one is a Likert item.
			question.survey_item = { type, ...base, options: keptOptions, rows: [row(), row()] };
		} else if (type === 'slider') {
			question.survey_item = {
				type,
				...base,
				min: range?.min ?? 0,
				max: range?.max ?? 10,
				step: range?.step ?? null,
				min_label: {},
				max_label: {}
			};
		} else if (type === 'number') {
			question.survey_item = {
				type,
				...base,
				min: range?.min,
				max: range?.max,
				step: range?.step
			};
		} else if (type === 'date') {
			question.survey_item = { type, ...base, min: asDate(dates?.min), max: asDate(dates?.max) };
		} else if (type === 'datetime') {
			question.survey_item = {
				type,
				...base,
				min: asDatetime(dates?.min),
				max: asDatetime(dates?.max)
			};
		} else if (type === 'time') {
			question.survey_item = { type, ...base };
		}
	}

	const guideStore = getGuideStore();

	// The item as a respondent in the language being edited would get it,
	// untranslated text falling back to the default language like the server's.
	let previewItem = $derived(
		renderSurveyItem(question.survey_item, guideStore.languages) as SurveyItemUnion | null
	);

	let previewQuestion = $derived(pick(question.main_question, guideStore.languages));

	/**
	 * The preview at the width a respondent's screen gives the item: the widest
	 * the interview's answer bubble gets on a computer, or a typical phone.
	 * The phone also gets the phone layout, which the editor's own (wide)
	 * screen would otherwise never show. A grid lays itself out by screen
	 * width alone, so it has no phone preview.
	 */
	let previewDevice = $state<'desktop' | 'phone'>('desktop');
	let previewPhone = $derived(previewDevice === 'phone' && previewItem?.type !== 'likert_grid');

	const optionReorder = createListReorder(
		() => surveyItemOptions(question.survey_item),
		'[data-option-row]'
	);
	const rowReorder = createListReorder(
		() => (question.survey_item?.type === 'likert_grid' ? question.survey_item.rows : undefined),
		'[data-grid-row]'
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
					{surveyItem.type === 'likert_grid'
						? `${surveyItem.rows.length} rows · ${surveyItem.options.length}-point scale (grid)`
						: surveyItem.type === 'number' ||
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
						onchange={(e) => changeType((e.target as HTMLSelectElement).value)}
					>
						<option value="radio">Single Choice</option>
						<option value="checkbox">Multiple Choice</option>
						<option value="likert">Likert Scale</option>
						<option value="likert_grid">Likert Grid</option>
						<option value="slider">Slider</option>
						<option value="number">Number</option>
						<option value="date">Date</option>
						<option value="datetime">Date & Time</option>
						<option value="time">Time</option>
					</select>
				</label>
				{#if surveyItem.type === 'likert_grid'}
					<div>
						<span class="mb-2 flex items-center gap-1 text-gray-500">
							Rows
							<HoverInfo
								iconColor="gray-500"
								text="The statements rated on the scale below. The main question is the grid's prompt; the respondent answers every row at once."
							></HoverInfo>
						</span>
						<div class="space-y-1">
							{#each surveyItem.rows as gridRow, rIdx (gridRow.id ?? rIdx)}
								<div
									data-grid-row
									class="flex items-center gap-1 transition-opacity"
									class:opacity-40={rowReorder.draggedIndex === rIdx}
									ondragover={(e) => rowReorder.dragOver(e, rIdx)}
									role="listitem"
								>
									<div
										class="cursor-grab rounded p-1 text-gray-400 outline-none hover:bg-gray-100 hover:text-gray-600"
										title="Reorder row"
										draggable="true"
										ondragstart={(e) => rowReorder.dragStart(e, rIdx)}
										ondragend={rowReorder.dragEnd}
										role="button"
										tabindex="-1"
										aria-label="Reorder row"
									>
										<i class="fa-solid fa-grip-vertical"></i>
									</div>
									<TextField
										class="flex-1 rounded border-gray-200 p-1.5 text-sm focus:border-primary focus:ring-primary/20"
										text={gridRow.text!}
										placeholder={`Row ${rIdx + 1}`}
									/>
									<button
										class="px-1 {gridRow.required !== false
											? 'text-red-500'
											: 'text-gray-300 hover:text-gray-500'}"
										onclick={() => (gridRow.required = gridRow.required === false)}
										title={gridRow.required !== false
											? 'Required: click to make optional'
											: 'Optional: click to make required'}
										aria-label="Toggle required"
										aria-pressed={gridRow.required !== false}
										><i class="fa-solid fa-asterisk"></i></button
									>
									<button
										class="px-1 text-gray-400 hover:text-red-500"
										onclick={() => surveyItem.rows.splice(rIdx, 1)}
										title="Remove row"><i class="fa-solid fa-trash"></i></button
									>
								</div>
							{/each}
							<button
								class="mt-1 text-sm font-medium text-primary hover:underline"
								onclick={() => surveyItem.rows.push(row())}>+ Add Row</button
							>
						</div>
					</div>
				{/if}
				{#if surveyItem.type === 'radio' || surveyItem.type === 'checkbox' || surveyItem.type === 'likert' || surveyItem.type === 'likert_grid'}
					<div>
						<span class="mb-2 block text-gray-500"
							>{surveyItem.type === 'likert_grid' ? 'Scale' : 'Options'}</span
						>
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
					<div class="mb-2 flex items-center justify-between gap-2">
						<div class="text-xs font-semibold tracking-wide text-gray-500 uppercase">
							Preview
							<span class="font-normal tracking-normal normal-case"> — as respondents see it</span>
						</div>
						{#if previewItem.type !== 'likert_grid'}
							<div
								class="flex shrink-0 rounded-md border border-gray-200 bg-white p-0.5 text-xs text-gray-500"
								role="group"
								aria-label="Preview screen size"
							>
								{#each [{ device: 'desktop', icon: 'fa-desktop', label: 'Computer' }, { device: 'phone', icon: 'fa-mobile-screen-button', label: 'Phone' }] as const as option (option.device)}
									<button
										type="button"
										class="rounded px-2 py-1 transition-colors {previewDevice === option.device
											? 'bg-gray-100 text-gray-800'
											: 'hover:text-gray-700'}"
										aria-pressed={previewDevice === option.device}
										title={option.label}
										onclick={() => (previewDevice = option.device)}
									>
										<i class="fa-solid {option.icon}" aria-hidden="true"></i>
										<span class="sr-only">{option.label}</span>
									</button>
								{/each}
							</div>
						{/if}
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
					<!-- Sized and styled like the respondent's answer bubble
					     (`MessageBubble`): as wide as its content up to the bubble's
					     cap, not the full cap, and with the text settings the item
					     inherits — language and hyphenation decide where labels
					     break. -->
					<div
						class="ml-auto text-sm break-words hyphens-auto {previewItem.type === 'likert_grid'
							? 'w-full'
							: `w-fit ${previewPhone ? 'max-w-76' : 'max-w-120'}`}"
						lang={guideStore.lang}
					>
						<!-- Re-mount on a type change: the answer state of one type is
					     meaningless, and can be out of range, for another. -->
						{#key `${previewItem.type}-${'ui' in previewItem ? previewItem.ui : ''}`}
							<SurveyItem
								{...previewItem}
								lang={guideStore.lang.toUpperCase()}
								phone={previewPhone}
								preview
							/>
						{/key}
					</div>
				</div>
			{/if}
		</div>
	</AccordionPanel>
{/if}
