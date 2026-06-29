<script lang="ts">
	import { Synthesize, type TestSetupPublic } from '$lib/api';
	import { untrack } from 'svelte';
	import { toast } from 'svelte-sonner';
	import SimulationActionBar from '../SimulationActionBar.svelte';

	let { test }: { test: TestSetupPublic } = $props();

	// Editable drafts seeded once from the test prop; deliberately not reactive to prop updates.
	let personas = $state(
		untrack(() => (test.fixed_personas?.length ? [...test.fixed_personas] : ['']))
	);
	let isSaving = $state(false);

	function addPersona() {
		personas.push('');
	}

	function removePersona(index: number) {
		personas.splice(index, 1);
	}

	async function saveSetup() {
		const nonEmpty = personas.filter((p) => p.trim().length > 0);
		if (nonEmpty.length === 0) {
			toast.error('Please add at least one persona');
			return;
		}

		isSaving = true;
		const { error } = await Synthesize.updateFixedPersonas({
			path: {
				project_id: test.project_id,
				test_id: test.id
			},
			body: {
				fixed_personas: nonEmpty
			}
		});
		isSaving = false;
		if (error) {
			console.error(error);
			toast.error('Failed to save personas');
			return;
		}
		toast.success('Personas saved');
	}
</script>

<div class="pb-32">
	<h1 class="page-title">Setup - Fixed AI Respondents</h1>
	<p class="text-gray-600">
		Define one persona per text area. Each persona will be used as-is for the AI respondent.
	</p>

	<div class="mt-6 flex flex-col gap-4">
		{#each personas as _, index (index)}
			<div class="flex gap-2">
				<textarea
					bind:value={personas[index]}
					placeholder="Describe persona {index + 1}..."
					rows="3"
					class="w-full flex-1 rounded border border-gray-300 p-2"
				></textarea>
				{#if personas.length > 1}
					<button
						onclick={() => removePersona(index)}
						class="self-start rounded p-2 text-gray-400 hover:text-red-500"
						title="Remove persona"
					>
						<i class="fa-solid fa-trash"></i>
					</button>
				{/if}
			</div>
		{/each}
	</div>

	<button
		onclick={addPersona}
		class="mt-4 flex w-fit items-center gap-2 rounded border border-dashed border-gray-300 px-4 py-2 text-gray-500 hover:border-gray-400 hover:text-gray-700"
	>
		<i class="fa-solid fa-plus"></i> Add Persona
	</button>
</div>

<SimulationActionBar current="setup" saving={isSaving} onSave={saveSetup} />
