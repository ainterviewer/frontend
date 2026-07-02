<script lang="ts">
	import AccordionPanel from './AccordionPanel.svelte';
	import type { GuideQuestion } from './types';

	interface Props {
		question: GuideQuestion;
		expanded?: boolean;
	}

	let { question, expanded = $bindable(false) }: Props = $props();

	function handleImageUpload(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files && input.files[0]) {
			const file = input.files[0];
			const reader = new FileReader();
			reader.onload = (ev) => {
				question.image = {
					...(question.image ?? { description: '', alt: '' }),
					data: ev.target?.result as string,
					name: file.name
				};
			};
			reader.readAsDataURL(file);
		}
	}
</script>

{#if question.image}
	{@const image = question.image}
	<AccordionPanel
		borderColor="border-l-sky-500"
		bind:expanded
		removeTitle="Remove Image"
		onremove={() => {
			question.image = null;
			expanded = false;
		}}
	>
		{#snippet header()}
			<div class="h-10 w-10 shrink-0 overflow-hidden rounded bg-gray-200">
				{#if typeof image.data === 'string'}
					<img src={image.data} alt="Preview" class="h-full w-full object-cover" />
				{:else}
					<div class="flex h-full w-full items-center justify-center bg-sky-50">
						<i class="fa-solid fa-image text-lg text-sky-600"></i>
					</div>
				{/if}
			</div>
			<div class="min-w-0 flex-1 text-left">
				<div class="truncate font-medium text-gray-700">
					{image.name || 'Image'}
				</div>
				<div class="truncate text-xs text-gray-500">
					{image.description || 'No description'}
				</div>
			</div>
		{/snippet}

		<div class="max-w-sm space-y-4">
			<div class="flex gap-2">
				{#if typeof image.data === 'string'}
					<img
						src={image.data}
						alt="Preview"
						class="h-16 w-16 rounded border bg-gray-100 object-cover"
					/>
				{/if}
				<div class="w-full flex-1 space-y-3">
					<input
						type="file"
						accept=".png,.jpg,.webp"
						class="w-full text-sm text-gray-500 file:mr-2 file:rounded-full file:border-0 file:bg-primary/10 file:px-2 file:py-1 file:text-sm file:font-semibold file:text-primary hover:file:bg-primary/20"
						onchange={handleImageUpload}
					/>
					<label class="flex flex-col">
						<span class="pb-1 text-sm font-semibold text-gray-500">Description</span>
						<input
							autocomplete="off"
							class="w-full rounded border-gray-200 p-1.5 text-sm focus:border-primary focus:ring-primary/20"
							placeholder="Description for AI..."
							bind:value={image.description}
						/>
					</label>
					<label class="flex flex-col">
						<span class="pb-1 font-semibold text-gray-500">Primer</span>
						<input
							autocomplete="off"
							class="w-full rounded border-gray-200 p-1.5 text-sm focus:border-primary focus:ring-primary/20"
							placeholder="Primer text..."
							bind:value={image.primer}
						/>
					</label>
					<label class="flex flex-col">
						<span class="pb-1 font-semibold text-gray-500">Alternative text (accessibility)</span>
						<input
							autocomplete="off"
							class="w-full rounded border-gray-200 p-1.5 text-sm focus:border-primary focus:ring-primary/20"
							placeholder="Alt text"
							bind:value={image.alt}
						/>
					</label>
				</div>
			</div>
		</div>
	</AccordionPanel>
{/if}
