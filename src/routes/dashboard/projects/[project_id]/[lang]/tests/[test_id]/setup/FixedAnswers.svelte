<script lang="ts">
	import { Default, type TestSetupPublic } from '$lib/api';

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
			await Default.updateFixedAnswers({
				path: {
					project_id: test.project_id,
					test_id: test.id
				},
				body: {
					answers: answers
				}
			});
			alert('Answers saved.');
		} catch (e) {
			console.error(e);
			alert('Failed to save setup.');
		} finally {
			isSaving = false;
		}
	}
</script>

<h2 class="page-title">Setup</h2>
<h3 class="mb-5 text-gray-800">Fixed answers</h3>
<p>Define fixed answers for each main question.</p>

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
<button
	onclick={saveSetup}
	disabled={isSaving}
	class="flex cursor-pointer items-center gap-1.5 rounded border-none bg-blue-50 px-4 py-2 text-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
>
	{isSaving ? 'Saving...' : 'Save'}
</button>
