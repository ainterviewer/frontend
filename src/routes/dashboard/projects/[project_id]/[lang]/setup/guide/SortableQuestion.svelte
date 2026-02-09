<script lang="ts">
	import HoverInfo from '$lib/components/HoverInfo.svelte';
	import { useSortable } from '@dnd-kit-svelte/svelte/sortable';
	import { slide } from 'svelte/transition';
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
	}

	let {
		question,
		sectionId,
		sectionIndex,
		index,
		allSections = [],
		allQuestions = {},
		onRemove,
		isOverlay = false
	}: Props = $props();
	let showSettings = $state(false);
	let expandedImage = $state(false);
	let expandedSurvey = $state(false);
	let expandedCondition = $state(false);

	const { ref, handleRef, isDragging } = useSortable({
		id: question.id,
		index: () => index,
		group: sectionId,
		type: 'question',
		accept: 'question',
		data: {
			type: 'question',
			question,
			sectionId
		}
	});

	function handleImageUpload(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files && input.files[0]) {
			const file = input.files[0];
			const reader = new FileReader();
			reader.onload = (ev) => {
				if (!question.image) question.image = { description: '', alt: '' };
				question.image.data = ev.target?.result as string;
				question.image.name = file.name;
			};
			reader.readAsDataURL(file);
		}
	}
</script>

<div
	id={question.id}
	class="group relative scroll-mt-24 rounded-lg border border-black bg-secondary p-5 brightness-105 transition-all duration-200 hover:shadow-md"
	class:opacity-50={isDragging.current && !isOverlay}
	class:shadow-xl={isOverlay}
	class:scale-[1.02]={isOverlay}
	class:rotate-1={isOverlay}
	class:border-l-4={!isOverlay}
	class:border-l-primary={!isOverlay}
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
				class="cursor-pointer rounded-md p-1.5 text-gray-700 transition-colors hover:text-primary"
				onclick={() => (showSettings = !showSettings)}
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
			<label class="mb-1 block text-xs font-bold tracking-wider text-gray-700 uppercase"
				>Description</label
			>
			<textarea
				class="h-22 w-full resize-none rounded-md border-gray-200 bg-gray-50 p-3 text-sm transition-colors focus:border-primary focus:bg-white focus:ring-primary/20"
				placeholder="Add some context or description..."
				bind:value={question.description}
			></textarea>
		</div>

		<div>
			<label class="mb-1 block text-xs font-bold tracking-wider text-gray-700 uppercase"
				>Main Question</label
			>
			<textarea
				class="h-18 w-full resize-none rounded-md border-gray-200 bg-gray-50 p-3 text-sm font-medium transition-colors focus:border-primary focus:bg-white focus:ring-primary/20"
				placeholder="What would you like to ask?"
				bind:value={question.main_question}
			></textarea>
		</div>

		<!-- Accordion Panels for Image/Survey/Condition -->
		{#if question.image || question.survey_item || question.conditions}
			<div class="flex flex-wrap gap-2 pt-2">
				{#if question.image}
					<div class="w-full rounded-md border border-gray-200 bg-gray-50 text-sm">
						<button
							class="flex w-full cursor-pointer items-center gap-3 p-2"
							onclick={() => (expandedImage = !expandedImage)}
						>
							<div class="h-10 w-10 flex-shrink-0 overflow-hidden rounded bg-gray-200">
								{#if question.image.data}
									<img src={question.image.data} alt="Preview" class="h-full w-full object-cover" />
								{:else}
									<div class="flex h-full w-full items-center justify-center bg-sky-50">
										<i class="fa-solid fa-image text-lg text-sky-600"></i>
									</div>
								{/if}
							</div>
							<div class="min-w-0 flex-1 text-left">
								<div class="truncate font-medium text-gray-700">
									{question.image.name || 'Image'}
								</div>
								<div class="truncate text-xs text-gray-500">
									{question.image.description || 'No description'}
								</div>
							</div>
							<i
								class="fa-solid fa-chevron-down text-xs text-gray-400 transition-transform duration-200"
								class:rotate-180={expandedImage}
							></i>
						</button>
						{#if expandedImage}
							<div
								transition:slide={{ duration: 200 }}
								class="relative border-t border-gray-200 p-3"
							>
								<button
									class="absolute top-2 right-2 cursor-pointer p-1 text-gray-400 hover:text-red-500"
									title="Remove Image"
									onclick={() => {
										question.image = null;
										expandedImage = false;
									}}
								>
									<i class="fa-solid fa-trash text-sm"></i>
								</button>
								<div class="max-w-sm space-y-4">
									<div class="flex gap-2">
										{#if question.image.data}
											<img
												src={question.image.data}
												alt="Preview"
												class="h-16 w-16 rounded border bg-gray-100 object-cover"
											/>
										{/if}
										<div class="w-full flex-1 space-y-2">
											<input
												type="file"
												accept=".png,.jpg,.webp"
												class="w-full text-sm text-gray-500 file:mr-2 file:rounded-full file:border-0 file:bg-primary/10 file:px-2 file:py-1 file:text-sm file:font-semibold file:text-primary hover:file:bg-primary/20"
												onchange={handleImageUpload}
											/>
											<input
												class="w-full rounded border-gray-200 p-1.5 text-sm focus:border-primary focus:ring-primary/20"
												placeholder="Description for AI..."
												bind:value={question.image.description}
											/>
										</div>
									</div>
									<input
										class="w-full rounded border-gray-200 p-1.5 text-sm focus:border-primary focus:ring-primary/20"
										placeholder="Primer text..."
										bind:value={question.image.primer}
									/>
									<input
										class="w-full rounded border-gray-200 p-1.5 text-sm focus:border-primary focus:ring-primary/20"
										placeholder="Alt text (accessibility)"
										bind:value={question.image.alt}
									/>
								</div>
							</div>
						{/if}
					</div>
				{/if}

				{#if question.survey_item}
					<div class="w-full rounded-md border border-gray-200 bg-gray-50 text-sm">
						<button
							class="flex w-full cursor-pointer items-center gap-3 p-2"
							onclick={() => (expandedSurvey = !expandedSurvey)}
						>
							<div
								class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-indigo-50 text-indigo-500"
							>
								<i class="fa-solid fa-square-poll-horizontal text-lg"></i>
							</div>
							<div class="min-w-0 flex-1 text-left">
								<div class="font-medium text-gray-700">Survey Item</div>
								<div class="text-xs text-gray-500">
									{question.survey_item.type === 'number' || question.survey_item.type === 'date'
										? question.survey_item.type
										: `${question.survey_item.options.length} options (${question.survey_item.type})`}
								</div>
							</div>
							<i
								class="fa-solid fa-chevron-down text-xs text-gray-400 transition-transform duration-200"
								class:rotate-180={expandedSurvey}
							></i>
						</button>
						{#if expandedSurvey}
							<div
								transition:slide={{ duration: 200 }}
								class="relative border-t border-gray-200 p-3"
							>
								<button
									class="absolute top-2 right-2 cursor-pointer p-1 text-gray-400 hover:text-red-500"
									title="Remove Survey Item"
									onclick={() => {
										question.survey_item = null;
										expandedSurvey = false;
									}}
								>
									<i class="fa-solid fa-trash text-sm"></i>
								</button>
								<div class="max-w-sm space-y-4 text-sm">
									<div>
										<label class="mb-2 block text-gray-500">Type</label>
										<select
											class="w-full rounded border-gray-200 bg-gray-50 p-1.5 text-sm focus:border-primary focus:ring-primary/20"
											bind:value={question.survey_item.type}
										>
											<option value="radio">Single Choice (Radio)</option>
											<option value="checkbox">Multiple Choice (Checkbox)</option>
											<option value="slider">Slider</option>
											<option value="number">Number</option>
											<option value="date">Date</option>
										</select>
									</div>
									{#if question.survey_item.type === 'radio' || question.survey_item.type === 'checkbox' || question.survey_item.type === 'slider'}
										<div>
											<label class="mb-2 block text-gray-500">Options</label>
											<div class="space-y-1">
												{#each question.survey_item.options as option, oIdx}
													<div class="flex gap-1">
														<input
															class="flex-1 rounded border-gray-200 p-1.5 text-sm focus:border-primary focus:ring-primary/20"
															bind:value={option.label}
															placeholder={`Option ${oIdx + 1}`}
														/>
														<button
															class="px-1 text-gray-400 hover:text-red-500"
															onclick={() => question.survey_item?.options.splice(oIdx, 1)}
															title="Remove Survey Option"><i class="fa-solid fa-trash"></i></button
														>
													</div>
												{/each}
												<button
													class="mt-1 text-sm font-medium text-primary hover:underline"
													onclick={() => question.survey_item?.options.push({ label: '' })}
													>+ Add Option</button
												>
											</div>
										</div>
									{/if}
									{#if question.survey_item.type === 'radio' || question.survey_item.type === 'checkbox'}
										<label
											class="mt-1 flex cursor-pointer items-center gap-2 text-sm text-gray-700 transition-colors hover:text-primary"
										>
											<input
												type="checkbox"
												class="rounded border-gray-300 text-primary focus:ring-primary"
												bind:checked={question.survey_item.with_other}
											/>
											Include "Other" option
											<HoverInfo
												iconColor="gray-500"
												text="Include and 'Other' option that allows the user to input their own answer."
											></HoverInfo>
										</label>
									{/if}
									{#if question.survey_item.type === 'number'}
										<div class="grid grid-cols-2 gap-2">
											<div>
												<label class="mb-2 block text-sm text-gray-500">Min</label>
												<input
													type="number"
													class="w-full rounded border-gray-200 p-1.5 text-sm focus:border-primary focus:ring-primary/20"
													placeholder="No min"
													bind:value={question.survey_item.min}
												/>
											</div>
											<div>
												<label class="mb-2 block text-sm text-gray-500">Max</label>
												<input
													type="number"
													class="w-full rounded border-gray-200 p-1.5 text-sm focus:border-primary focus:ring-primary/20"
													placeholder="No max"
													bind:value={question.survey_item.max}
												/>
											</div>
										</div>
									{/if}
								</div>
							</div>
						{/if}
					</div>
				{/if}

				{#if question.conditions}
					<div class="w-full rounded-md border border-gray-200 bg-gray-50 text-sm">
						<button
							class="flex w-full cursor-pointer items-center gap-3 p-2"
							onclick={() => (expandedCondition = !expandedCondition)}
						>
							<div
								class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-amber-50 text-amber-600"
							>
								<i class="fa-solid fa-code-branch text-lg"></i>
							</div>
							<div class="min-w-0 flex-1 text-left">
								<div class="font-medium text-gray-700">Condition</div>
								<div class="text-xs text-gray-500">
									{#if question.conditions.conditions.length === 1}
										{@const cond = question.conditions.conditions[0]}
										{question.conditions.action.replace(/_/g, ' ')} based on Section {cond
											.question_context.section + 1}, Question {cond.question_context.question +
											1}{#if cond.evaluation.length > 1}
											<span class="ml-1">({cond.evaluation.length} rules)</span>
										{/if}
									{:else}
										{question.conditions.action.replace(/_/g, ' ')} based on {question.conditions
											.conditions.length} conditions
									{/if}
								</div>
							</div>
							<i
								class="fa-solid fa-chevron-down text-xs text-gray-400 transition-transform duration-200"
								class:rotate-180={expandedCondition}
							></i>
						</button>
						{#if expandedCondition}
							<div
								transition:slide={{ duration: 200 }}
								class="relative border-t border-gray-200 p-3"
							>
								<button
									class="absolute top-2 right-2 cursor-pointer p-1 text-gray-400 hover:text-red-500"
									title="Remove Conditions"
									onclick={() => {
										question.conditions = null;
										expandedCondition = false;
									}}
								>
									<i class="fa-solid fa-trash text-sm"></i>
								</button>
								<div class="max-w-lg space-y-3">
									<!-- Action -->
									<div>
										<label class="mb-2 block text-sm font-bold text-gray-500"
											>Action when conditions are met</label
										>
										<select
											class="w-full rounded border-gray-200 bg-gray-50 p-1.5 text-sm focus:border-primary focus:ring-primary/20"
											bind:value={question.conditions.action}
										>
											<option value="ask_question">Ask this question</option>
											<option value="skip_question">Skip this question</option>
											<option value="skip_section">Skip entire section</option>
											<option value="end_interview">End interview</option>
										</select>
									</div>

									<!-- Condition Blocks -->
									<div class="space-y-2">
										<label class="block text-sm font-bold text-gray-500">Condition blocks</label>
										{#each question.conditions.conditions as condition, condIdx}
											{@const referencedQuestion = allSections[condition.question_context.section]
												? (allQuestions[allSections[condition.question_context.section].id] || [])[
														condition.question_context.question
													]
												: null}
											{@const isNumericOrDate =
												referencedQuestion?.survey_item?.type === 'number' ||
												referencedQuestion?.survey_item?.type === 'date' ||
												referencedQuestion?.survey_item?.type === 'slider'}
											{@const hasSurveyOptions = referencedQuestion?.survey_item?.options?.length}

											<div class="rounded-md border border-gray-300 bg-gray-50/50 p-3">
												<div class="mb-2 flex items-center justify-between">
													<span class="text-sm font-medium text-gray-600"
														>Condition {condIdx + 1}</span
													>
													{#if question.conditions.conditions.length > 1}
														<button
															class="p-1 text-gray-400 hover:text-red-500"
															onclick={() => {
																if (question.conditions) {
																	if (
																		condIdx > 0 &&
																		condIdx === question.conditions.conditions.length - 1
																	) {
																		question.conditions.conditions[condIdx - 1].combine_next = null;
																	}
																	question.conditions.conditions.splice(condIdx, 1);
																}
															}}
															title="Remove this condition block"
														>
															<i class="fa-solid fa-times text-xs"></i>
														</button>
													{/if}
												</div>

												<div class="space-y-4">
													<!-- Question Context -->
													<div>
														<label class="mb-2 block text-sm text-gray-500"
															>Based on answer to</label
														>
														<select
															class="w-full rounded border-gray-200 bg-white p-1.5 text-sm focus:border-primary focus:ring-primary/20"
															value={`${condition.question_context.section}-${condition.question_context.question}`}
															onchange={(e) => {
																const [sIdx, qIdx] = (e.target as HTMLSelectElement).value
																	.split('-')
																	.map(Number);
																condition.question_context.section = sIdx;
																condition.question_context.question = qIdx;
															}}
														>
															{#each allSections as sec, sIdx}
																{#if sIdx <= sectionIndex}
																	{#each allQuestions[sec.id] || [] as q, qIdx}
																		{#if sIdx < sectionIndex || qIdx <= index}
																			<option value={`${sIdx}-${qIdx}`}>
																				Section {sIdx + 1} > Question {qIdx + 1}
																				{q.main_question
																					? `: ${q.main_question.slice(0, 30)}...`
																					: ''}
																			</option>
																		{/if}
																	{/each}
																{/if}
															{/each}
														</select>
													</div>

													<!-- Negate Condition -->
													<div class="flex items-center">
														<label
															class="flex cursor-pointer items-center gap-2 text-sm text-gray-700 transition-colors hover:text-primary"
														>
															<input
																type="checkbox"
																class="rounded border-gray-300 text-primary focus:ring-primary"
																bind:checked={condition.negated}
															/>
															Negate this condition
														</label>
													</div>

													<!-- Evaluations -->
													<div class="space-y-1">
														<label class="mb-1 block text-sm text-gray-500">Trigger value(s)</label>
														{#each condition.evaluation as evaluation, evalIdx}
															<div class="space-y-1">
																<div
																	class="flex items-start gap-2 rounded border border-gray-100 bg-white p-2"
																>
																	<div class="flex-1 space-y-2">
																		{#if isNumericOrDate}
																			<div>
																				<label class="mb-1 block text-sm text-gray-400"
																					>Operator</label
																				>
																				<select
																					class="w-full rounded border-gray-200 bg-gray-50 p-1.5 text-sm focus:border-primary focus:ring-primary/20"
																					bind:value={evaluation.comparison_operator}
																				>
																					<option value="==">Equals (==)</option>
																					<option value="<">Less than (&lt;)</option>
																					<option value="<=">Less than or equal (&lt;=)</option>
																					<option value=">">Greater than (&gt;)</option>
																					<option value=">=">Greater than or equal (&gt;=)</option>
																				</select>
																			</div>
																		{/if}

																		<div>
																			<label class="mb-1 block text-sm text-gray-400">Value</label>
																			{#if referencedQuestion?.survey_item?.type === 'number'}
																				<input
																					type="number"
																					class="w-full rounded border-gray-200 bg-gray-50 p-1.5 text-sm focus:border-primary focus:ring-primary/20"
																					placeholder="Value to compare..."
																					bind:value={evaluation.trigger_value}
																				/>
																			{:else if referencedQuestion?.survey_item?.type === 'date'}
																				<input
																					type="date"
																					class="w-full rounded border-gray-200 bg-gray-50 p-1.5 text-sm focus:border-primary focus:ring-primary/20"
																					bind:value={evaluation.trigger_value}
																				/>
																			{:else if hasSurveyOptions}
																				{@const selectedValues = condition.evaluation
																					.filter((_, i) => i !== evalIdx)
																					.map((e) => e.trigger_value)
																					.filter(Boolean)}
																				<select
																					class="w-full rounded border-gray-200 bg-gray-50 p-1.5 text-sm focus:border-primary focus:ring-primary/20"
																					bind:value={evaluation.trigger_value}
																				>
																					<option value="">Select an option...</option>
																					{#each referencedQuestion.survey_item?.options || [] as option}
																						<option
																							value={option.label}
																							disabled={selectedValues.includes(option.label)}
																							>{option.label}</option
																						>
																					{/each}
																				</select>
																			{:else}
																				<input
																					class="w-full rounded border-gray-200 bg-gray-50 p-1.5 text-sm focus:border-primary focus:ring-primary/20"
																					placeholder="Value to match..."
																					bind:value={evaluation.trigger_value}
																				/>
																			{/if}
																		</div>
																	</div>

																	{#if condition.evaluation.length > 1}
																		<button
																			class="mt-5 p-1 text-gray-400 hover:text-red-500"
																			onclick={() => {
																				if (
																					evalIdx > 0 &&
																					evalIdx === condition.evaluation.length - 1
																				) {
																					condition.evaluation[evalIdx - 1].combine_next = null;
																				}
																				condition.evaluation.splice(evalIdx, 1);
																			}}
																			title="Remove this evaluation"
																		>
																			<i class="fa-solid fa-times text-xs"></i>
																		</button>
																	{/if}
																</div>

																{#if evaluation.combine_next}
																	<div class="flex items-center justify-center gap-2 py-1">
																		<div class="h-px flex-1 bg-gray-200"></div>
																		<span
																			class="rounded bg-gray-100 px-2 py-0.5 text-sm font-medium text-gray-600"
																		>
																			{evaluation.combine_next}
																		</span>
																		<div class="h-px flex-1 bg-gray-200"></div>
																	</div>
																{:else if evalIdx === condition.evaluation.length - 1}
																	<div class="flex items-center justify-center gap-2 pt-1">
																		<button
																			class="rounded border px-2 py-0.5 text-sm font-medium transition-colors {referencedQuestion
																				?.survey_item?.type === 'checkbox'
																				? 'border-gray-300 text-gray-600 hover:border-primary hover:bg-primary/5 hover:text-primary'
																				: 'cursor-not-allowed border-gray-200 text-gray-300'}"
																			onclick={() => {
																				evaluation.combine_next = 'AND';
																				condition.evaluation.push({
																					trigger_value: '',
																					comparison_operator: '=='
																				});
																			}}
																			disabled={referencedQuestion?.survey_item?.type !==
																				'checkbox'}
																		>
																			+ AND
																		</button>
																		<button
																			class="rounded border border-gray-300 px-2 py-0.5 text-sm font-medium text-gray-600 transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
																			onclick={() => {
																				evaluation.combine_next = 'OR';
																				condition.evaluation.push({
																					trigger_value: '',
																					comparison_operator: '=='
																				});
																			}}
																		>
																			+ OR
																		</button>
																	</div>
																{/if}
															</div>
														{/each}
													</div>
												</div>
											</div>

											<!-- AND/OR connector between condition blocks -->
											{#if condition.combine_next}
												<div class="flex items-center justify-center gap-2 py-1">
													<div class="h-px flex-1 bg-amber-200"></div>
													<span
														class="rounded bg-amber-100 px-3 py-1 text-sm font-bold text-amber-700"
													>
														{condition.combine_next}
													</span>
													<div class="h-px flex-1 bg-amber-200"></div>
												</div>
											{:else if condIdx === question.conditions.conditions.length - 1}
												<div class="flex items-center justify-center gap-2 pt-2">
													<button
														class="rounded border border-amber-300 bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700 transition-colors hover:border-amber-400 hover:bg-amber-100"
														onclick={() => {
															if (question.conditions) {
																condition.combine_next = 'AND';
																question.conditions.conditions.push({
																	trigger_type: 'match',
																	negated: false,
																	evaluation: [
																		{
																			trigger_value: '',
																			comparison_operator: '=='
																		}
																	],
																	question_context: {
																		section: 0,
																		question: 0,
																		part: 'main'
																	}
																});
															}
														}}
													>
														+ AND condition
													</button>
													<button
														class="rounded border border-amber-300 bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700 transition-colors hover:border-amber-400 hover:bg-amber-100"
														onclick={() => {
															if (question.conditions) {
																condition.combine_next = 'OR';
																question.conditions.conditions.push({
																	trigger_type: 'match',
																	negated: false,
																	evaluation: [
																		{
																			trigger_value: '',
																			comparison_operator: '=='
																		}
																	],
																	question_context: {
																		section: 0,
																		question: 0,
																		part: 'main'
																	}
																});
															}
														}}
													>
														+ OR condition
													</button>
												</div>
											{/if}
										{/each}
									</div>
								</div>
							</div>
						{/if}
					</div>
				{/if}
			</div>
		{/if}

		<!-- Collapsible Settings -->
		{#if showSettings}
			<div
				transition:slide={{ duration: 200 }}
				class="-mx-5 space-y-6 border-t border-gray-100 bg-gray-50/30 px-5 pt-4 pb-4"
			>
				<!-- Add buttons for Image/Survey/Condition -->
				<div class="space-y-4">
					{#if !question.image || !question.survey_item || !question.conditions}
						<div class="flex flex-wrap gap-4">
							{#if !question.image}
								<button
									class="flex items-center gap-2 rounded border border-gray-400 px-2 py-1 text-sm font-medium text-gray-600 transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
									onclick={() => {
										question.image = { description: '', alt: '' };
										expandedImage = true;
									}}
								>
									<i class="fa-solid fa-image text-sky-600"></i> Add Image
								</button>
							{/if}
							{#if !question.survey_item}
								<button
									class="flex items-center gap-2 rounded border border-gray-400 px-2 py-1 text-sm font-medium text-gray-600 transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
									onclick={() => {
										question.survey_item = {
											type: 'radio',
											options: [{ label: 'Option 1' }]
										};
										expandedSurvey = true;
									}}
								>
									<i class="fa-solid fa-square-poll-horizontal text-indigo-500"></i> Add Survey Item
								</button>
							{/if}
							{#if !question.conditions}
								<button
									class="flex items-center gap-2 rounded border border-gray-400 px-2 py-1 text-sm font-medium text-gray-600 transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
									onclick={() => {
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
														section: 0,
														question: 0,
														part: 'main'
													}
												}
											]
										};
										expandedCondition = true;
									}}
								>
									<i class="fa-solid fa-code-branch text-amber-600"></i> Add Condition
								</button>
							{/if}
						</div>
					{/if}
				</div>

				<!-- Alternative Main Questions -->
				<div class="hidden">
					<label class="mb-2 block text-xs font-bold tracking-wider text-gray-700 uppercase"
						>Alternative Phrasings</label
					>
					{#if question.alternative_main_questions}
						<div class="mb-2 space-y-2">
							{#each question.alternative_main_questions as _, aqIdx}
								<div class="flex gap-2">
									<input
										class="flex-1 rounded border-gray-200 p-2 text-sm shadow-sm focus:border-primary focus:ring-primary/20"
										bind:value={question.alternative_main_questions[aqIdx]}
										placeholder="Another way to ask this..."
									/>
									<button
										class="px-2 text-gray-400 hover:text-red-500"
										onclick={() => question.alternative_main_questions?.splice(aqIdx, 1)}
										><i class="fa-solid fa-trash"></i></button
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
				<div>
					<label class="mb-2 block text-xs font-bold tracking-wider text-gray-700 uppercase"
						>Follow-up Probes</label
					>
					{#if question.probes}
						<div class="mb-2 space-y-2">
							{#each question.probes as _, pIdx}
								<div class="flex gap-2">
									<input
										class="flex-1 rounded border-gray-200 p-2 text-sm shadow-sm focus:border-primary focus:ring-primary/20"
										bind:value={question.probes[pIdx]}
										placeholder="Follow-up question if needed..."
									/>
									<button
										class="px-2 text-gray-400 hover:text-red-500"
										onclick={() => question.probes?.splice(pIdx, 1)}
										><i class="fa-solid fa-trash"></i></button
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
					<div class="space-y-3">
						<label class="text-xs font-bold tracking-wider text-gray-700 uppercase"
							>Probing Limits</label
						>
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
								<span class="text-sm text-gray-700">Time spend probing (seconds)</span>
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
					<div class="col-span-2 space-y-3">
						<label class="text-xs font-bold tracking-wider text-gray-700 uppercase"
							>Behavior Flags</label
						>
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
			</div>
		{/if}
	</div>
</div>
