<script lang="ts">
	import { untrack } from 'svelte';

	import { Synthesize, type TestSetupPublic } from '$lib/api';
	import { Autosaver, saveRevisioned } from '$lib/content/autosave.svelte';
	import AutosavePill from '$lib/content/AutosavePill.svelte';

	import SimulationActionBar from '../SimulationActionBar.svelte';

	let { test, revision }: { test: TestSetupPublic; revision: string | null } = $props();

	// Editable drafts seeded once from the test prop; deliberately not reactive to prop updates.
	let personas = $state(
		untrack(() => (test.fixed_personas?.length ? [...test.fixed_personas] : ['']))
	);

	function addPersona() {
		personas.push('');
	}

	function removePersona(index: number) {
		personas.splice(index, 1);
	}

	// The setup's revision, moved on by each save; a save based on an older one
	// is refused (someone else saved) and the pill offers to keep either.
	const etag = { value: untrack(() => revision) };

	// Saved as it is edited; there is no Save.
	const saver = new Autosaver({
		read: () => personas.filter((p) => p.trim().length > 0),
		save: async (fixed_personas, overwrite) => {
			if (fixed_personas.length === 0) {
				return { ok: false, invalid: 'Not saved: add at least one persona' };
			}
			return saveRevisioned(
				etag,
				(headers) =>
					Synthesize.updateFixedPersonas({
						path: { project_id: test.project_id, test_id: test.id },
						body: { fixed_personas },
						headers
					}),
				overwrite
			);
		}
	});
	saver.watch();
</script>

<AutosavePill savers={[saver]} />

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

<SimulationActionBar current="setup" />
