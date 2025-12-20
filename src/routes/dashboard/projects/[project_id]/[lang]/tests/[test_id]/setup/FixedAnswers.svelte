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

<div style="width: 80%; max-width: 1000px">
	<h2 class="underline-simple">Setup</h2>
	<h3>Fixed answers</h3>
	<p>Define fixed answers for each main question.</p>

	{#each questions as question, index}
		<div class="section">
			<h4>Main question {index + 1}</h4>
			<span type="text">{question}</span>
			<div>
				<label for="question-{index}-answer">Answer: </label>
				<input type="text" id="question-{index}-answer" bind:value={answers[index]} />
			</div>
		</div>
	{/each}
	<button onclick={saveSetup} disabled={isSaving}>
		{isSaving ? 'Saving...' : 'Save'}
	</button>
</div>

<style>
	.section {
		margin-bottom: 24px;
	}

	.section > div {
		display: flex;
		flex-direction: column;
		margin-top: 10px;
	}

	.section > span {
		font-style: italic;
	}

	input {
		padding: 8px;
		border: 1px solid #ccc;
		border-radius: 4px;
		flex: 1;
		width: 100%;
	}

	button {
		padding: 8px 16px;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 5px;
		background-color: #e6f3ff;
		color: #0066cc;
	}

	button:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	h3 {
		color: #333;
		margin-bottom: 20px;
	}

	h4 {
		color: #666;
		margin-bottom: 10px;
		margin-top: 30px;
	}

	.underline-simple {
		border-bottom: 2px solid #eee;
		padding-bottom: 10px;
		margin-bottom: 20px;
	}
</style>
