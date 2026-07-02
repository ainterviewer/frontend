<script lang="ts">
	import { getGuideStore } from '$lib/stores/guideStore.svelte';
	import AccordionPanel from './AccordionPanel.svelte';
	import type { GuideQuestion, GuideSection } from './types';
	import { isConditionTargetValid, surveyItemOptions } from './utils';

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
	// position (and the referenced question) for display and validation.
	function resolveTarget(ctx: { sectionId: string; questionId: string }) {
		const sectionIdx = allSections.findIndex((s) => s.id === ctx.sectionId);
		const questions = allQuestions[ctx.sectionId] || [];
		const questionIdx = questions.findIndex((q) => q.id === ctx.questionId);
		return {
			sectionIdx,
			questionIdx,
			question: questionIdx >= 0 ? questions[questionIdx] : null
		};
	}

	// A new condition block defaults to the first question, which is always at or
	// before the current one.
	function defaultContext() {
		const firstSection = allSections[0];
		return {
			sectionId: firstSection?.id ?? '',
			questionId: firstSection ? (allQuestions[firstSection.id]?.[0]?.id ?? '') : '',
			part: 'main' as const
		};
	}

	// A condition block is invalid when it targets a later (or non-existent)
	// question/section. This can happen after reordering, since the picker only
	// prevents forward references at creation time.
	function isBlockValid(ctx: { sectionId: string; questionId: string }): boolean {
		return isConditionTargetValid(sectionIndex, index, ctx, allSections, allQuestions);
	}

	let hasInvalidTarget = $derived(
		(question.conditions?.conditions ?? []).some((c) => !isBlockValid(c.question_context))
	);

	// The last save attempt flagged this question's conditions. Draw attention by
	// auto-expanding the panel so the highlighted blocks are visible.
	let flaggedBySave = $derived(guideStore.invalidConditionQuestionIds.includes(question.id));

	$effect(() => {
		if (flaggedBySave && hasInvalidTarget) {
			expanded = true;
		}
	});

	// A condition triggers by matching a survey answer when the referenced
	// question has a survey item, otherwise by AI classification of free text.
	$effect(() => {
		if (!question.conditions) return;
		for (const cond of question.conditions.conditions) {
			const refQ = resolveTarget(cond.question_context).question;
			const desired = refQ?.survey_item ? 'match' : 'classification';
			if (cond.trigger_type !== desired) {
				cond.trigger_type = desired;
			}
		}
	});
</script>

{#if question.conditions}
	{@const conditions = question.conditions}
	<AccordionPanel
		borderColor={hasInvalidTarget ? 'border-l-red-500' : 'border-l-amber-600'}
		bind:expanded
		removeTitle="Remove Conditions"
		onremove={() => {
			question.conditions = null;
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
				<div class="font-medium text-gray-700">Condition</div>
				{#if hasInvalidTarget}
					<div class="flex items-start gap-1.5 text-xs text-red-600">
						<i class="fa-solid fa-triangle-exclamation mt-0.5"></i>
						<span>
							References a later or missing question. Pick a question that comes before this one.
						</span>
					</div>
				{:else}
					<div class="text-xs text-gray-500">
						{#if conditions.conditions.length === 1}
							{@const cond = conditions.conditions[0]}
							{@const target = resolveTarget(cond.question_context)}
							{conditions.action.replace(/_/g, ' ')} based on Section {target.sectionIdx + 1},
							Question {target.questionIdx + 1}{#if cond.evaluation.length > 1}
								<span class="ml-1">({cond.evaluation.length} rules)</span>
							{/if}
						{:else}
							{conditions.action.replace(/_/g, ' ')} based on {conditions.conditions.length} conditions
						{/if}
					</div>
				{/if}
			</div>
		{/snippet}

		<div class="max-w-lg space-y-3">
			<!-- Action -->
			<label class="mb-2 block text-sm font-bold text-gray-500">
				Action when conditions are met
				<select
					class="mt-1 w-full rounded border-gray-200 bg-gray-50 p-1.5 text-sm font-normal focus:border-primary focus:ring-primary/20"
					bind:value={conditions.action}
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
				{#each conditions.conditions as condition, condIdx (condIdx)}
					{@const referencedQuestion = resolveTarget(condition.question_context).question}
					{@const isNumericOrDate =
						referencedQuestion?.survey_item?.type === 'number' ||
						referencedQuestion?.survey_item?.type === 'date' ||
						referencedQuestion?.survey_item?.type === 'datetime' ||
						referencedQuestion?.survey_item?.type === 'time' ||
						referencedQuestion?.survey_item?.type === 'slider'}
					{@const hasSurveyOptions = surveyItemOptions(referencedQuestion?.survey_item)?.length}
					{@const targetValid = isBlockValid(condition.question_context)}

					<div
						class="rounded-md border p-3 {targetValid
							? 'border-gray-300 bg-gray-50/50'
							: 'border-red-400 bg-red-50/50'}"
					>
						<div class="mb-2 flex items-center justify-between">
							<span class="text-sm font-medium text-gray-600">Condition {condIdx + 1}</span>
							{#if conditions.conditions.length > 1}
								<button
									class="p-1 text-gray-400 hover:text-red-500"
									onclick={() => {
										if (condIdx > 0 && condIdx === conditions.conditions.length - 1) {
											conditions.conditions[condIdx - 1].combine_next = null;
										}
										conditions.conditions.splice(condIdx, 1);
									}}
									title="Remove this condition block"
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
									value={`${condition.question_context.sectionId}|${condition.question_context.questionId}`}
									onchange={(e) => {
										const [sId, qId] = (e.target as HTMLSelectElement).value.split('|');
										condition.question_context.sectionId = sId;
										condition.question_context.questionId = qId;
									}}
								>
									{#each allSections as sec, sIdx (sec.id)}
										{#if sIdx <= sectionIndex}
											{#each allQuestions[sec.id] || [] as q, qIdx (q.id)}
												{#if sIdx < sectionIndex || qIdx <= index}
													<option value={`${sec.id}|${q.id}`}>
														Section {sIdx + 1} > Question {qIdx + 1}
														{q.main_question ? `: ${q.main_question.slice(0, 30)}...` : ''}
													</option>
												{/if}
											{/each}
										{/if}
									{/each}
								</select>
							</label>

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
								<span class="mb-1 block text-sm text-gray-500">Trigger value(s)</span>
								{#each condition.evaluation as evaluation, evalIdx (evalIdx)}
									<div class="space-y-1">
										<div class="flex items-start gap-2 rounded border border-gray-100 bg-white p-2">
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
														{@const selectedValues = condition.evaluation
															.filter((_, i) => i !== evalIdx)
															.map((e) => e.trigger_value)
															.filter(Boolean)}
														<select
															class="w-full rounded border-gray-200 bg-gray-50 p-1.5 text-sm focus:border-primary focus:ring-primary/20"
															bind:value={evaluation.trigger_value}
														>
															<option value="">Select an option...</option>
															{#each surveyItemOptions(referencedQuestion?.survey_item) || [] as option (option)}
																<option value={option} disabled={selectedValues.includes(option)}
																	>{option}</option
																>
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

											{#if condition.evaluation.length > 1}
												<button
													class="mt-5 p-1 text-gray-400 hover:text-red-500"
													onclick={() => {
														if (evalIdx > 0 && evalIdx === condition.evaluation.length - 1) {
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
													disabled={referencedQuestion?.survey_item?.type !== 'checkbox'}
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
							<span class="rounded bg-amber-100 px-3 py-1 text-sm font-bold text-amber-700">
								{condition.combine_next}
							</span>
							<div class="h-px flex-1 bg-amber-200"></div>
						</div>
					{:else if condIdx === conditions.conditions.length - 1}
						<div class="flex items-center justify-center gap-2 pt-2">
							<button
								class="rounded border border-amber-300 bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700 transition-colors hover:border-amber-400 hover:bg-amber-100"
								onclick={() => {
									condition.combine_next = 'AND';
									conditions.conditions.push({
										trigger_type: 'match',
										negated: false,
										evaluation: [
											{
												trigger_value: '',
												comparison_operator: '=='
											}
										],
										question_context: defaultContext()
									});
								}}
							>
								+ AND condition
							</button>
							<button
								class="rounded border border-amber-300 bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700 transition-colors hover:border-amber-400 hover:bg-amber-100"
								onclick={() => {
									condition.combine_next = 'OR';
									conditions.conditions.push({
										trigger_type: 'match',
										negated: false,
										evaluation: [
											{
												trigger_value: '',
												comparison_operator: '=='
											}
										],
										question_context: defaultContext()
									});
								}}
							>
								+ OR condition
							</button>
						</div>
					{/if}
				{/each}
			</div>
		</div>
	</AccordionPanel>
{/if}
