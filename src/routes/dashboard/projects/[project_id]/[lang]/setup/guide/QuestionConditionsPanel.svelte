<script lang="ts">
	import AccordionPanel from './AccordionPanel.svelte';
	import type { GuideQuestion, GuideSection } from './types';
	import { surveyItemOptions } from './utils';

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

	// A condition triggers by matching a survey answer when the referenced
	// question has a survey item, otherwise by AI classification of free text.
	$effect(() => {
		if (!question.conditions) return;
		for (const cond of question.conditions.conditions) {
			const refSection = allSections[cond.question_context.section];
			const refQ = refSection
				? (allQuestions[refSection.id] || [])[cond.question_context.question]
				: null;
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
		borderColor="border-l-amber-600"
		bind:expanded
		removeTitle="Remove Conditions"
		onremove={() => {
			question.conditions = null;
			expanded = false;
		}}
	>
		{#snippet header()}
			<div
				class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-amber-50 text-amber-600"
			>
				<i class="fa-solid fa-code-branch text-lg"></i>
			</div>
			<div class="min-w-0 flex-1 text-left">
				<div class="font-medium text-gray-700">Condition</div>
				<div class="text-xs text-gray-500">
					{#if conditions.conditions.length === 1}
						{@const cond = conditions.conditions[0]}
						{conditions.action.replace(/_/g, ' ')} based on Section {cond.question_context.section +
							1}, Question {cond.question_context.question + 1}{#if cond.evaluation.length > 1}
							<span class="ml-1">({cond.evaluation.length} rules)</span>
						{/if}
					{:else}
						{conditions.action.replace(/_/g, ' ')} based on {conditions.conditions.length} conditions
					{/if}
				</div>
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
					{@const referencedQuestion = allSections[condition.question_context.section]
						? (allQuestions[allSections[condition.question_context.section].id] || [])[
								condition.question_context.question
							]
						: null}
					{@const isNumericOrDate =
						referencedQuestion?.survey_item?.type === 'number' ||
						referencedQuestion?.survey_item?.type === 'date' ||
						referencedQuestion?.survey_item?.type === 'datetime' ||
						referencedQuestion?.survey_item?.type === 'time' ||
						referencedQuestion?.survey_item?.type === 'slider'}
					{@const hasSurveyOptions = surveyItemOptions(referencedQuestion?.survey_item)?.length}

					<div class="rounded-md border border-gray-300 bg-gray-50/50 p-3">
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
									value={`${condition.question_context.section}-${condition.question_context.question}`}
									onchange={(e) => {
										const [sIdx, qIdx] = (e.target as HTMLSelectElement).value
											.split('-')
											.map(Number);
										condition.question_context.section = sIdx;
										condition.question_context.question = qIdx;
									}}
								>
									{#each allSections as sec, sIdx (sec.id)}
										{#if sIdx <= sectionIndex}
											{#each allQuestions[sec.id] || [] as q, qIdx (q.id)}
												{#if sIdx < sectionIndex || qIdx <= index}
													<option value={`${sIdx}-${qIdx}`}>
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
										question_context: {
											section: 0,
											question: 0,
											part: 'main'
										}
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
										question_context: {
											section: 0,
											question: 0,
											part: 'main'
										}
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
