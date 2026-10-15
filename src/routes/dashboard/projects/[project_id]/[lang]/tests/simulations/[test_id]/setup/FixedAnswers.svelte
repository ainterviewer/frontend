<script lang="ts">
	import { untrack } from 'svelte';

	import { type Question, Synthesize, type TestSetupPublic } from '$lib/api';
	import { Autosaver, saveRevisioned } from '$lib/content/autosave.svelte';
	import AutosavePill from '$lib/content/AutosavePill.svelte';
	import { sanitizeMarkup } from '$lib/utils/sanitize';

	import SimulationActionBar from '../SimulationActionBar.svelte';

	type SetupQuestion = Pick<Question, 'main_question' | 'can_answer'> & { id: string };
	type SetupSection = { description: string; questions: SetupQuestion[] };

	let {
		test,
		sections,
		revision
	}: { test: TestSetupPublic; sections: SetupSection[]; revision: string | null } = $props();

	// By question id, so an answer stays with its question however the guide is
	// reordered or the interview shuffles it. Seeded once from the test prop;
	// deliberately not reactive to prop updates.
	let answers = $state<Record<string, string>>(untrack(() => ({ ...test.fixed_answers })));

	// The setup's revision, moved on by each save; a save based on an older one
	// is refused (someone else saved) and the pill offers to keep either.
	const etag = { value: untrack(() => revision) };

	// Saved as it is edited; there is no Save. Only the questions still in the
	// guide: an answer to one removed since would never be asked for.
	const saver = new Autosaver({
		read: () =>
			Object.fromEntries(
				sections
					.flatMap((section) => section.questions)
					.filter((question) => question.can_answer === true && answers[question.id]?.trim())
					.map((question) => [question.id, answers[question.id]])
			),
		save: (answers, overwrite) =>
			saveRevisioned(
				etag,
				(headers) =>
					Synthesize.updateFixedAnswers({
						path: { project_id: test.project_id, test_id: test.id },
						body: { answers },
						headers
					}),
				overwrite
			)
	});
	saver.watch();
</script>

<AutosavePill savers={[saver]} />

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
					<!-- eslint-disable-next-line svelte/no-at-html-tags -->
					<span class="italic">{@html sanitizeMarkup(question.main_question)}</span>
					{#if question.can_answer === true}
						<div class="mt-2.5 flex flex-col">
							<label for="question-{sectionIndex}-{questionIndex}-answer">Answer: </label>
							<input
								type="text"
								id="question-{sectionIndex}-{questionIndex}-answer"
								bind:value={answers[question.id]}
								class="w-full flex-1 rounded border border-gray-300 p-2"
							/>
						</div>
					{/if}
				</div>
			{/each}
		</section>
	{/each}
</div>

<SimulationActionBar current="setup" />
