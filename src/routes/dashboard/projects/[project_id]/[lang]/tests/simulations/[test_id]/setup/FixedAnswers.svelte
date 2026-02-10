<script lang="ts">
	import { Synthesize, type TestSetupPublic } from '$lib/api';
	import toast from 'svelte-hot-french-toast';

	let { test, questions }: { test: TestSetupPublic; questions: string[] } = $props();

	let answers = $state(test.fixed_answers ? [...test.fixed_answers] : []);

	// Ensure answers array is same length as questions
	$effect(() => {
		if (answers.length < questions.length) {
			answers = [...answers, ...new Array(questions.length - answers.length).fill('')];
		}
	});

	let isSaving = $state(false);

	async function saveSetup() {
		isSaving = true;
		try {
			await Synthesize.updateFixedAnswers({
				path: {
					project_id: test.project_id,
					test_id: test.id
				},
				body: {
					answers: answers
				}
			});
			toast.success('Answers saved');
		} catch (e) {
			console.error(e);
			toast.error('Failed to save setup');
		} finally {
			isSaving = false;
		}
	}
</script>

<h1 class="page-title">Setup - Fixed Answers</h1>
<p class="text-gray-600">Define fixed answers for each main question.</p>

{#each questions as question, index}
	<div class="mb-6">
		<h4 class="mt-8 mb-2.5 text-gray-500">Main question {index + 1}</h4>
		<span class="italic">{question}</span>
		<div class="mt-2.5 flex flex-col">
			<label for="question-{index}-answer">Answer: </label>
			<input
				type="text"
				id="question-{index}-answer"
				bind:value={answers[index]}
				class="w-full flex-1 rounded border border-gray-300 p-2"
			/>
		</div>
	</div>
{/each}

<div
	class="sticky bottom-0 ml-auto flex w-fit gap-4 rounded-full border border-gray-200 bg-white/90 p-4 shadow-lg backdrop-blur"
>
	<button
		onclick={saveSetup}
		disabled={isSaving}
		class="flex items-center gap-2 rounded-full bg-primary px-6 py-2 font-medium text-white shadow-sm hover:bg-dark disabled:cursor-not-allowed disabled:opacity-50"
	>
		{#if isSaving}
			<i class="fas fa-spinner fa-spin"></i> Saving...
		{:else}
			<i class="fa-solid fa-floppy-disk"></i> Save Setup
		{/if}
	</button>
</div>
