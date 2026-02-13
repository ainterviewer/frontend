<script lang="ts">
	import { Synthesize, type TestSetupPublic } from '$lib/api';
	import { toast } from 'svelte-sonner';

	let { test }: { test: TestSetupPublic } = $props();

	let personas = $state(test.fixed_personas?.length ? [...test.fixed_personas] : ['']);
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
		try {
			await Synthesize.updateFixedPersonas({
				path: {
					project_id: test.project_id,
					test_id: test.id
				},
				body: {
					fixed_personas: nonEmpty
				}
			});
			toast.success('Personas saved');
		} catch (e) {
			console.error(e);
			toast.error('Failed to save personas');
		} finally {
			isSaving = false;
		}
	}
</script>

<h1 class="page-title">Setup - Fixed AI Personas</h1>
<p class="text-gray-600">Define one persona per text area. Each persona will be used as-is for the AI respondent.</p>

<div class="mt-6 flex flex-col gap-4">
	{#each personas as _, index}
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
	class="mt-4 flex items-center gap-2 rounded border border-dashed border-gray-300 px-4 py-2 text-gray-500 hover:border-gray-400 hover:text-gray-700"
>
	<i class="fa-solid fa-plus"></i> Add Persona
</button>

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
