<script lang="ts">
	let {
		open = $bindable(),
		title = 'Generate',
		onGenerate,
		placeholder = 'Describe what you want to generate...'
	} = $props<{
		open: boolean;
		title?: string;
		onGenerate: (prompt: string) => Promise<void>;
		placeholder?: string;
	}>();

	let generatePrompt = $state('');
	let generating = $state(false);

	async function handleGenerate() {
		generating = true;
		try {
			await onGenerate(generatePrompt);
			open = false;
			generatePrompt = ''; // Reset prompt after success
		} catch (e) {
			console.error('Failed to generate', e);
			alert('Failed to generate. Please try again.');
		} finally {
			generating = false;
		}
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
	>
		<div class="w-full max-w-lg overflow-hidden rounded-lg bg-white shadow-xl">
			<div class="flex items-center justify-between border-b p-4">
				<h3 class="text-lg font-semibold">{title}</h3>
				<button
					class="text-gray-400 hover:text-gray-600"
					onclick={() => (open = false)}
					aria-label="Close modal"
				>
					<i class="fa-solid fa-xmark text-xl"></i>
				</button>
			</div>
			<div class="p-6">
				<label class="mb-2 block text-sm font-medium text-gray-700" for="prompt">Prompt</label>
				<textarea
					id="prompt"
					class="h-32 w-full rounded border border-gray-300 p-3 focus:border-blue-500 focus:ring-blue-500"
					{placeholder}
					bind:value={generatePrompt}
				></textarea>
			</div>
			<div class="flex justify-end gap-3 border-t bg-gray-50 p-4">
				<button
					class="rounded px-4 py-2 text-gray-600 hover:bg-gray-200"
					onclick={() => (open = false)}
				>
					Cancel
				</button>
				<button
					class="flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
					onclick={handleGenerate}
					disabled={generating || !generatePrompt.trim()}
				>
					{#if generating}
						<i class="fa-solid fa-spinner fa-spin"></i> Generating...
					{:else}
						Generate
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}
