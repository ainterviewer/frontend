<script lang="ts">
	import { Synthesize, type Question, type TestSetupPublic } from '$lib/api';
	import { untrack } from 'svelte';
	import { toast } from 'svelte-sonner';
	import SimulationActionBar from '../SimulationActionBar.svelte';

	type SetupQuestion = Pick<Question, 'main_question' | 'can_answer'>;
	type SetupSection = { description: string; questions: SetupQuestion[] };

	let { test, sections }: { test: TestSetupPublic; sections: SetupSection[] } = $props();
	// Seeded once from the test prop; deliberately not reactive to prop updates.
	const initialFixedAnswers = untrack(() => (test.fixed_answers ? [...test.fixed_answers] : []));

	// Answers are stored as one flat list, in guide order across all sections.
	const answerIndexesBySection = $derived.by(() => {
		let answerIndex = 0;

		return sections.map((section) =>
			section.questions.map((question) => {
				if (question.can_answer !== true) {
					return -1;
				}

				const currentIndex = answerIndex;
				answerIndex += 1;
				return currentIndex;
			})
		);
	});

	const answerableQuestionCount = $derived(
		answerIndexesBySection.flat().filter((answerIndex) => answerIndex !== -1).length
	);

	let answers = $state(initialFixedAnswers);

	// Ensure answers array is same length as answerable questions.
	$effect(() => {
		if (answers.length < answerableQuestionCount) {
			answers = [...answers, ...new Array(answerableQuestionCount - answers.length).fill('')];
		} else if (answers.length > answerableQuestionCount) {
			answers = answers.slice(0, answerableQuestionCount);
		}
	});

	let isSaving = $state(false);

	async function saveSetup() {
		isSaving = true;
		const { error } = await Synthesize.updateFixedAnswers({
			path: {
				project_id: test.project_id,
				test_id: test.id
			},
			body: {
				answers
			}
		});
		isSaving = false;
		if (error) {
			console.error(error);
			toast.error('Failed to save setup');
			return;
		}
		toast.success('Answers saved');
	}
</script>

<div class="pb-32">
	<h1 class="page-title">Setup - Fixed Answers</h1>
	<p class="text-gray-600">Define fixed answers for each main question.</p>

	{#each sections as section, sectionIndex (sectionIndex)}
		<section class="mt-10">
			<h2 class="font-bold text-black">Section {sectionIndex + 1}</h2>
			{#if section.description}
				<p class="text-sm text-gray-500">{section.description}</p>
			{/if}

			{#each section.questions as question, questionIndex (questionIndex)}
				<div class="mb-6">
					<h4 class="mt-8 mb-2.5 text-gray-500">
						Question {sectionIndex + 1}.{questionIndex + 1}
					</h4>
					<span class="italic">{question.main_question}</span>
					{#if question.can_answer === true}
						<div class="mt-2.5 flex flex-col">
							<label for="question-{sectionIndex}-{questionIndex}-answer">Answer: </label>
							<input
								type="text"
								id="question-{sectionIndex}-{questionIndex}-answer"
								bind:value={answers[answerIndexesBySection[sectionIndex][questionIndex]]}
								class="w-full flex-1 rounded border border-gray-300 p-2"
							/>
						</div>
					{/if}
				</div>
			{/each}
		</section>
	{/each}
</div>

<SimulationActionBar current="setup" saving={isSaving} onSave={saveSetup} />
