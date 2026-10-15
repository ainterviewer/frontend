<script lang="ts">
	import { toast } from 'svelte-sonner';

	import { page } from '$app/state';
	import { Projects } from '$lib/api';
	import { getGuideStore } from '$lib/stores/guideStore.svelte';

	import AccordionPanel from './AccordionPanel.svelte';
	import { pick } from './localized';
	import TextField from './TextField.svelte';
	import type { GuideQuestion } from './types';

	interface Props {
		question: GuideQuestion;
		expanded?: boolean;
	}

	let { question, expanded = $bindable(false) }: Props = $props();

	const guideStore = getGuideStore();

	// A preview of the file chosen here, for this tab only: the guide is shared
	// and saved as it changes, so it names the uploaded file and never carries
	// the image itself.
	let preview = $state<string | null>(null);
	let uploading = $state(false);

	async function handleImageUpload(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		uploading = true;
		const { data: name, error } = await Projects.uploadImage({
			path: { project_id: page.params.project_id ?? '' },
			body: { file }
		});
		uploading = false;
		if (error || !name) {
			toast.error('Failed to upload the image');
			return;
		}
		if (preview) URL.revokeObjectURL(preview);
		preview = URL.createObjectURL(file);
		question.image = {
			...(question.image ?? { description: {}, alt: {}, primer: {} }),
			data: null,
			name
		};
	}

	$effect(() => () => {
		if (preview) URL.revokeObjectURL(preview);
	});

	let shown = $derived(
		preview ?? (typeof question.image?.data === 'string' ? question.image.data : null)
	);
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
				{#if shown}
					<img src={shown} alt="Preview" class="h-full w-full object-cover" />
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
					{pick(image.description, guideStore.languages) || 'No description'}
				</div>
			</div>
		{/snippet}

		<div class="max-w-sm space-y-4">
			<div class="flex gap-2">
				{#if shown}
					<img
						src={shown}
						alt="Preview"
						class="h-16 w-16 rounded border bg-gray-100 object-cover"
					/>
				{/if}
				<div class="w-full flex-1 space-y-3">
					<input
						type="file"
						accept=".png,.jpg,.webp"
						class="w-full text-sm text-gray-500 file:mr-2 file:rounded-full file:border-0 file:bg-primary/10 file:px-2 file:py-1 file:text-sm file:font-semibold file:text-primary hover:file:bg-primary/20"
						disabled={uploading}
						onchange={handleImageUpload}
					/>
					<label class="flex flex-col">
						<span class="pb-1 text-sm font-semibold text-gray-500">Description</span>
						<TextField
							class="w-full rounded border-gray-200 p-1.5 text-sm focus:border-primary focus:ring-primary/20"
							placeholder="Description for AI..."
							text={image.description}
						/>
					</label>
					<label class="flex flex-col">
						<span class="pb-1 font-semibold text-gray-500">Primer</span>
						<TextField
							class="w-full rounded border-gray-200 p-1.5 text-sm focus:border-primary focus:ring-primary/20"
							placeholder="Primer text..."
							text={image.primer}
						/>
					</label>
					<label class="flex flex-col">
						<span class="pb-1 font-semibold text-gray-500">Alternative text (accessibility)</span>
						<TextField
							class="w-full rounded border-gray-200 p-1.5 text-sm focus:border-primary focus:ring-primary/20"
							placeholder="Alt text"
							text={image.alt}
						/>
					</label>
				</div>
			</div>
		</div>
	</AccordionPanel>
{/if}
