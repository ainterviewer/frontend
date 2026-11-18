<script lang="ts">
	import {
		conditionOptions,
		isConditionOptionValid,
		isConditionTargetValid,
		isOrdinalItem,
		mayGoUnasked,
		newCondition,
		newConditionBlock,
		resolveConditionTarget
	} from '$lib/guide/conditions';
	import { pick } from '$lib/guide/localized';
	import type { GuideQuestion, GuideSection, LocalConditionBlock } from '$lib/guide/types';
	import { getGuideStore } from '$lib/stores/guideStore.svelte';

	import AccordionPanel from './AccordionPanel.svelte';

	interface Props {
		question: GuideQuestion;
		sectionIndex: number;
		index: number;
		allSections?: GuideSection[];
		allQuestions?: Record<string, GuideQuestion[]>;
		expanded?: boolean;
	}

	let {
		question,
		sectionIndex,
		index,
		allSections = [],
		allQuestions = {},
		expanded = $bindable(false)
	}: Props = $props();

	const guideStore = getGuideStore();

	// Condition targets are stored by stable id; resolve one to its current
	// position (and the referenced question) for display and validation. The
	// resolver also follows a question that was dragged into another section, so
	// `sectionId` here is the section it lives in *now*, which may differ from the
	// one stored on the condition.
	function resolveTarget(ctx: { sectionId: string; questionId: string }) {
		const { sectionIndex, questionIndex, sectionId, question } = resolveConditionTarget(
			ctx,
			allSections,
			allQuestions
		);
		return { sectionIdx: sectionIndex, questionIdx: questionIndex, sectionId, question };
	}

	// Where a new condition or block points when the guide has no first
	// question to default to: this one.
	let here = $derived({ sectionId: allSections[sectionIndex]?.id ?? '', questionId: question.id });

	// A condition block is invalid when it targets a later (or non-existent)
	// question/section. This can happen after reordering, since the picker only
	// prevents forward references at creation time.
	function isBlockValid(ctx: { sectionId: string; questionId: string }): boolean {
		return isConditionTargetValid(sectionIndex, index, ctx, allSections, allQuestions);
	}

	// ...or when it matches a choice but names no option of it: none picked yet,
	// or the option was deleted.
	function hasMissingOption(block: LocalConditionBlock): boolean {
		const target = resolveTarget(block.question_context).question;
		return block.evaluation.some((e) => !isConditionOptionValid(e, target));
	}

	let hasInvalidTarget = $derived(
		question.conditions
			.flatMap((condition) => condition.blocks)
			.some((block) => !isBlockValid(block.question_context) || hasMissingOption(block))
	);

	// The last save attempt flagged this question's conditions. Draw attention by
	// auto-expanding the panel so the highlighted blocks are visible.
	let flaggedBySave = $derived(guideStore.invalidConditionQuestionIds.includes(question.id));

	$effect(() => {
		if (flaggedBySave && hasInvalidTarget) {
			expanded = true;
		}
	});

	// A block triggers by matching a survey answer when the referenced question
	// has a survey item, otherwise by AI classification of free text.
	$effect(() => {
		for (const block of question.conditions.flatMap((condition) => condition.blocks)) {
			const refQ = resolveTarget(block.question_context).question;
			const desired = refQ?.survey_item ? 'match' : 'classification';
			if (block.trigger_type !== desired) {
				block.trigger_type = desired;
			}
		}
	});

	function actionLabel(action: string): string {
		return action.replace(/_/g, ' ');
	}
</script>

{#if question.conditions.length > 0}
	<AccordionPanel
		borderColor={hasInvalidTarget ? 'border-l-red-500' : 'border-l-amber-600'}
		bind:expanded
		removeTitle="Remove all conditions"
		onremove={() => {
			question.conditions = [];
			expanded = false;
		}}
	>
		{#snippet header()}
			<div
				class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded {hasInvalidTarget
					? 'bg-red-50 text-red-600'
					: 'bg-amber-50 text-amber-600'}"
			>
				<i class="fa-solid fa-code-branch text-lg"></i>
			</div>
			<div class="min-w-0 flex-1 text-left">
				<div class="font-medium text-gray-700">
					{question.conditions.length === 1 ? 'Condition' : 'Conditions'}
				</div>
				{#if hasInvalidTarget}
					<div class="flex items-start gap-1.5 text-xs text-red-600">
						<i class="fa-solid fa-triangle-exclamation mt-0.5"></i>
						<span>
							References a later or missing question, or no option of it. Pick a question that comes
							before this one, and one of its options.
						</span>
					</div>
				{:else}
					<div class="text-xs text-gray-500">
						{#if question.conditions.length > 1}
							{question.conditions.map((condition) => actionLabel(condition.action)).join(', ')}
						{:else if question.conditions[0].blocks.length === 1}
							{@const block = question.conditions[0].blocks[0]}
							{@const target = resolveTarget(block.question_context)}
							{actionLabel(question.conditions[0].action)} based on Section {target.sectionIdx + 1},
							Question {target.questionIdx + 1}{#if block.evaluation.length > 1}
								<span class="ml-1">({block.evaluation.length} rules)</span>
							{/if}
						{:else}
							{actionLabel(question.conditions[0].action)} based on {question.conditions[0].blocks
								.length} blocks
						{/if}
					</div>
				{/if}
			</div>
		{/snippet}

		<div class="max-w-lg space-y-4">
			{#each question.conditions as condition, conditionIdx (condition.id)}
				<div class="space-y-3 rounded-md border border-amber-200 bg-amber-50/30 p-3">
					<div class="flex items-center justify-between">
						<span class="text-sm font-bold text-gray-600">Condition {conditionIdx + 1}</span>
						<button
							class="p-1 text-gray-400 hover:text-red-500"
							onclick={() => {
								question.conditions.splice(conditionIdx, 1);
								if (question.conditions.length === 0) expanded = false;
							}}
							title="Remove this condition"
						>
							<i class="fa-solid fa-trash text-xs"></i>
						</button>
					</div>

					<!-- Action -->
					<label class="mb-2 block text-sm font-bold text-gray-500">
						Action when met
						<select
							class="mt-1 w-full rounded border-gray-200 bg-gray-50 p-1.5 text-sm font-normal focus:border-primary focus:ring-primary/20"
							bind:value={condition.action}
						>
							<option value="skip_probes">Skip probes</option>
							<option value="skip_question">Skip this question</option>
							<option value="skip_section">Skip entire section</option>
							<option value="end_interview">End interview</option>
						</select>
					</label>

					<!-- Condition Blocks -->
					<div class="space-y-2">
						<span class="block text-sm font-bold text-gray-500">Condition blocks</span>
						{#each condition.blocks as block, blockIdx (blockIdx)}
							{@const resolved = resolveTarget(block.question_context)}
							{@const referencedQuestion = resolved.question}
							{@const isNumericOrDate =
								referencedQuestion?.survey_item?.type === 'number' ||
								referencedQuestion?.survey_item?.type === 'date' ||
								referencedQuestion?.survey_item?.type === 'datetime' ||
								referencedQuestion?.survey_item?.type === 'time' ||
								referencedQuestion?.survey_item?.type === 'slider'}
							{@const isOrdinal = isOrdinalItem(referencedQuestion)}
							{@const allowsAnd = referencedQuestion?.survey_item?.type === 'checkbox' || isOrdinal}
							{@const hasSurveyOptions = conditionOptions(referencedQuestion?.survey_item)?.length}
							{@const targetValid =
								isBlockValid(block.question_context) && !hasMissingOption(block)}

							<div
								class="rounded-md border p-3 {targetValid
									? 'border-gray-300 bg-gray-50/50'
									: 'border-red-400 bg-red-50/50'}"
							>
								<div class="mb-2 flex items-center justify-between">
									<span class="text-sm font-medium text-gray-600">Block {blockIdx + 1}</span>
									{#if condition.blocks.length > 1}
										<button
											class="p-1 text-gray-400 hover:text-red-500"
											onclick={() => {
												if (blockIdx > 0 && blockIdx === condition.blocks.length - 1) {
													condition.blocks[blockIdx - 1].combine_next = null;
												}
												condition.blocks.splice(blockIdx, 1);
											}}
											title="Remove this block"
										>
											<i class="fa-solid fa-times text-xs"></i>
										</button>
									{/if}
								</div>

								<div class="space-y-4">
									<!-- Question Context -->
									<label class="mb-2 block text-sm text-gray-500">
										Based on answer to
										<select
											class="mt-1 w-full rounded border-gray-200 bg-white p-1.5 text-sm focus:border-primary focus:ring-primary/20"
											value={`${resolved.sectionId}|${block.question_context.questionId}`}
											onchange={(e) => {
												const [sId, qId] = (e.target as HTMLSelectElement).value.split('|');
												block.question_context.sectionId = sId;
												block.question_context.questionId = qId;
											}}
										>
											{#each allSections as sec, sIdx (sec.id)}
												{#if sIdx <= sectionIndex}
													{#each allQuestions[sec.id] || [] as q, qIdx (q.id)}
														{#if (sIdx < sectionIndex || qIdx <= index) && q.survey_item?.type !== 'likert_grid'}
															<option value={`${sec.id}|${q.id}`}>
																Section {sIdx + 1} > Question {qIdx + 1}
																{pick(q.main_question, guideStore.languages)
																	? `: ${pick(q.main_question, guideStore.languages).slice(0, 30)}...`
																	: ''}
															</option>
														{/if}
													{/each}
												{/if}
											{/each}
										</select>
									</label>

									{#if targetValid && referencedQuestion?.id !== question.id && mayGoUnasked(block.question_context, allSections, allQuestions)}
										<p class="flex items-start gap-1.5 text-xs text-amber-700">
											<i class="fa-solid fa-circle-info mt-0.5"></i>
											<span>
												That question has conditions of its own, so some respondents are never asked
												it. For them this block is unknown: the action only happens if the other
												blocks decide it on their own.
											</span>
										</p>
									{/if}

									<!-- Negate Condition -->
									<div class="flex items-center">
										<label
											class="flex cursor-pointer items-center gap-2 text-sm text-gray-700 transition-colors hover:text-primary"
										>
											<input
												type="checkbox"
												class="rounded border-gray-300 text-primary focus:ring-primary"
												bind:checked={block.negated}
											/>
											Negate this block
										</label>
									</div>

									<!-- Evaluations -->
									<div class="space-y-1">
										<span class="mb-1 block text-sm text-gray-500">Trigger value(s)</span>
										{#each block.evaluation as evaluation, evalIdx (evalIdx)}
											<div class="space-y-1">
												<div
													class="flex items-start gap-2 rounded border border-gray-100 bg-white p-2"
												>
													<div class="flex-1 space-y-2">
														{#if isNumericOrDate}
															<label class="mb-1 block text-sm text-gray-400">
																Operator
																<select
																	class="mt-1 w-full rounded border-gray-200 bg-gray-50 p-1.5 text-sm focus:border-primary focus:ring-primary/20"
																	bind:value={evaluation.comparison_operator}
																>
																	<option value="==">Equals (==)</option>
																	<option value="<">Less than (&lt;)</option>
																	<option value="<=">Less than or equal (&lt;=)</option>
																	<option value=">">Greater than (&gt;)</option>
																	<option value=">=">Greater than or equal (&gt;=)</option>
																</select>
															</label>
														{:else if isOrdinal}
															<!-- Compared by place on the scale: an option listed earlier
															     is lower. -->
															<label class="mb-1 block text-sm text-gray-400">
																Operator
																<select
																	class="mt-1 w-full rounded border-gray-200 bg-gray-50 p-1.5 text-sm focus:border-primary focus:ring-primary/20"
																	bind:value={evaluation.comparison_operator}
																>
																	<option value="==">Is (==)</option>
																	<option value="<">Before on the scale (&lt;)</option>
																	<option value="<=">At or before (&lt;=)</option>
																	<option value=">">After on the scale (&gt;)</option>
																	<option value=">=">At or after (&gt;=)</option>
																</select>
															</label>
														{/if}

														<div>
															<span class="required mb-1 block text-sm text-gray-400">Value</span>
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
															{:else if referencedQuestion?.survey_item?.type === 'datetime'}
																<input
																	type="datetime-local"
																	class="w-full rounded border-gray-200 bg-gray-50 p-1.5 text-sm focus:border-primary focus:ring-primary/20"
																	bind:value={evaluation.trigger_value}
																/>
															{:else if referencedQuestion?.survey_item?.type === 'time'}
																<input
																	type="time"
																	class="w-full rounded border-gray-200 bg-gray-50 p-1.5 text-sm focus:border-primary focus:ring-primary/20"
																	bind:value={evaluation.trigger_value}
																/>
															{:else if hasSurveyOptions}
																<!-- An option is named by id, so the block holds in every
																     language and survives the option being reworded. -->
																<!-- On a scale, one option can bound a range from
																     both sides ("> Neutral AND <= Agree"). -->
																{@const selectedIds = isOrdinal
																	? []
																	: block.evaluation
																			.filter((_, i) => i !== evalIdx)
																			.map((e) => e.option_id)
																			.filter(Boolean)}
																<select
																	class="w-full rounded border-gray-200 bg-gray-50 p-1.5 text-sm focus:border-primary focus:ring-primary/20"
																	bind:value={evaluation.option_id}
																>
																	<option value={null}>Select an option...</option>
																	{#each conditionOptions(referencedQuestion?.survey_item) || [] as option, oIdx (option.id)}
																		<option
																			value={option.id}
																			disabled={selectedIds.includes(option.id)}
																		>
																			{pick(option.text, guideStore.languages) ||
																				`Option ${oIdx + 1}`}
																		</option>
																	{/each}
																</select>
															{:else}
																<input
																	class="w-full rounded border-gray-200 bg-gray-50 p-1.5 text-sm focus:border-primary focus:ring-primary/20"
																	placeholder="e.g. user expressed dissatisfaction"
																	bind:value={evaluation.trigger_value}
																/>
																<p class="mt-1 text-xs text-gray-500">
																	<i class="fa-solid fa-wand-magic-sparkles mr-1"></i>
																	Matched via classification &mdash; describe the answer pattern to detect.
																</p>
															{/if}
														</div>
													</div>

													{#if block.evaluation.length > 1}
														<button
															class="mt-5 p-1 text-gray-400 hover:text-red-500"
															onclick={() => {
																if (evalIdx > 0 && evalIdx === block.evaluation.length - 1) {
																	block.evaluation[evalIdx - 1].combine_next = null;
																}
																block.evaluation.splice(evalIdx, 1);
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
												{:else if evalIdx === block.evaluation.length - 1}
													<div class="flex items-center justify-center gap-2 pt-1">
														<button
															class="rounded border px-2 py-0.5 text-sm font-medium transition-colors {allowsAnd
																? 'border-gray-300 text-gray-600 hover:border-primary hover:bg-primary/5 hover:text-primary'
																: 'cursor-not-allowed border-gray-200 text-gray-300'}"
															onclick={() => {
																evaluation.combine_next = 'AND';
																block.evaluation.push({
																	option_id: null,
																	trigger_value: '',
																	comparison_operator: '=='
																});
															}}
															disabled={!allowsAnd}
														>
															+ AND
														</button>
														<button
															class="rounded border border-gray-300 px-2 py-0.5 text-sm font-medium text-gray-600 transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
															onclick={() => {
																evaluation.combine_next = 'OR';
																block.evaluation.push({
																	option_id: null,
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
							{#if block.combine_next}
								<div class="flex items-center justify-center gap-2 py-1">
									<div class="h-px flex-1 bg-amber-200"></div>
									<span class="rounded bg-amber-100 px-3 py-1 text-sm font-bold text-amber-700">
										{block.combine_next}
									</span>
									<div class="h-px flex-1 bg-amber-200"></div>
								</div>
							{:else if blockIdx === condition.blocks.length - 1}
								<div class="flex items-center justify-center gap-2 pt-2">
									<button
										class="rounded border border-amber-300 bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700 transition-colors hover:border-amber-400 hover:bg-amber-100"
										onclick={() => {
											block.combine_next = 'AND';
											condition.blocks.push(newConditionBlock(allSections, allQuestions, here));
										}}
									>
										+ AND block
									</button>
									<button
										class="rounded border border-amber-300 bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700 transition-colors hover:border-amber-400 hover:bg-amber-100"
										onclick={() => {
											block.combine_next = 'OR';
											condition.blocks.push(newConditionBlock(allSections, allQuestions, here));
										}}
									>
										+ OR block
									</button>
								</div>
							{/if}
						{/each}
					</div>
				</div>
			{/each}

			<button
				class="flex items-center gap-2 rounded border border-gray-400 px-2 py-1 text-sm font-medium text-gray-600 transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
				onclick={() => question.conditions.push(newCondition(allSections, allQuestions, here))}
			>
				<i class="fa-solid fa-code-branch text-amber-600"></i> Add condition
			</button>
			{#if question.conditions.length > 1}
				<p class="text-xs text-gray-500">
					Each condition is checked on its own. When several are met at once, the strongest action
					is taken: end interview, then skip section, skip question, skip probes.
				</p>
			{/if}
		</div>
	</AccordionPanel>
{/if}
