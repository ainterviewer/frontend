<script lang="ts">
	import { Synthesize, type QuestionOutput, type TestSetupPublic } from '$lib/api';
	import { untrack } from 'svelte';
	import { toast } from 'svelte-sonner';
	import SimulationActionBar from '../SimulationActionBar.svelte';

	type SetupQuestion = Pick<QuestionOutput, 'main_question' | 'can_answer'>;

	let { test, questions }: { test: TestSetupPublic; questions: SetupQuestion[] } = $props();
	// Seeded once from the test prop; deliberately not reactive to prop updates.
	const initialFixedAnswers = untrack(() => (test.fixed_answers ? [...test.fixed_answers] : []));

	const answerIndexesByQuestion = $derived.by(() => {
		let answerIndex = 0;

		return questions.map((question) => {
			if (question.can_answer !== true) {
				return -1;
			}

			const currentIndex = answerIndex;
			answerIndex += 1;
			return currentIndex;
		});
	});

	const answerableQuestionCount = $derived(
		answerIndexesByQuestion.filter((answerIndex) => answerIndex !== -1).length
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

	{#each questions as question, index (index)}
		<div class="mb-6">
			<h4 class="mt-8 mb-2.5 text-gray-500">Main question {index + 1}</h4>
			<span class="italic">{question.main_question}</span>
			{#if question.can_answer === true}
				<div class="mt-2.5 flex flex-col">
					<label for="question-{index}-answer">Answer: </label>
					<input
						type="text"
						id="question-{index}-answer"
						bind:value={answers[answerIndexesByQuestion[index]]}
						class="w-full flex-1 rounded border border-gray-300 p-2"
					/>
				</div>
			{/if}
		</div>
	{/each}
</div>

<SimulationActionBar current="setup" saving={isSaving} onSave={saveSetup} />
