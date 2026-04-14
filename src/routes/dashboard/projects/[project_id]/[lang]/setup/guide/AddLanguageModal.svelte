<script lang="ts">
	import type { LanguageDict } from '$lib/api';
	import { Default } from '$lib/api';
	import { toast } from 'svelte-sonner';

	let {
		open = $bindable(),
		onAdd,
		existingLanguageCodes
	}: {
		open: boolean;
		onAdd: (code: string, translate: boolean) => Promise<void>;
		existingLanguageCodes: string[];
	} = $props();

	let languages: LanguageDict[] = $state([]);
	let loading = $state(false);
	let error: string | null = $state(null);
	let search = $state('');
	let addingCode: string | null = $state(null);
	let translate = $state(true);

	let filteredLanguages = $derived(
		languages
			.filter((lang) => !existingLanguageCodes.includes(lang.code))
			.filter(
				(lang) =>
					lang.name.toLowerCase().includes(search.toLowerCase()) ||
					lang.code.toLowerCase().includes(search.toLowerCase())
			)
	);

	$effect(() => {
		if (open) {
			translate = true;
			fetchLanguages();
		}
	});

	async function fetchLanguages() {
		search = '';
		loading = true;
		error = null;
		try {
			const { data, error: apiError } = await Default.getLanguages();
			if (apiError) {
				error = 'Failed to load languages.';
			} else if (data) {
				languages = data;
			}
		} catch {
			error = 'Failed to load languages.';
		} finally {
			loading = false;
		}
	}

	async function handleAdd(code: string) {
		addingCode = code;
		try {
			await onAdd(code, translate);
			open = false;
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to add language.');
		} finally {
			addingCode = null;
		}
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		onclick={(e) => {
			if (e.target === e.currentTarget) open = false;
		}}
	>
		<div class="min-h-[28rem] w-full max-w-lg overflow-hidden rounded-lg bg-white shadow-xl">
			<div class="flex items-center justify-between p-4">
				<h3 class="text-lg font-semibold">Add Language</h3>
				<button
					class="text-gray-400 hover:text-gray-600"
					onclick={() => (open = false)}
					aria-label="Close modal"
				>
					<i class="fa-solid fa-xmark text-xl"></i>
				</button>
			</div>

			<div class="px-4 pb-2">
				<input
					type="text"
					placeholder="Search languages..."
					class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
					bind:value={search}
				/>
				<label
					class="mt-3 flex w-fit cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm text-gray-600 hover:bg-gray-50"
				>
					<input
						type="checkbox"
						class="h-4 w-4 cursor-pointer rounded border-gray-300 text-primary focus:ring-primary"
						bind:checked={translate}
						disabled={addingCode !== null}
					/>
					Auto-translate content
				</label>
			</div>

			<div class="max-h-80 overflow-y-auto px-4 pb-4">
				{#if loading}
					<div class="flex items-center justify-center py-8">
						<i class="fa-solid fa-spinner fa-spin text-xl text-gray-400"></i>
					</div>
				{:else if error}
					<div class="py-8 text-center text-sm text-red-500">{error}</div>
				{:else if filteredLanguages.length === 0}
					<div class="py-8 text-center text-sm text-gray-500">No languages available.</div>
				{:else}
					{#each filteredLanguages as lang (lang.code)}
						<button
							class="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-gray-100 disabled:opacity-50"
							onclick={() => handleAdd(lang.code)}
							disabled={addingCode !== null}
						>
							<span>
								<span class="font-medium">{lang.name}</span>
								<span class="ml-2 text-gray-400">{lang.code}</span>
							</span>
							{#if addingCode === lang.code}
								<i class="fa-solid fa-spinner fa-spin text-gray-400"></i>
							{/if}
						</button>
					{/each}
				{/if}
			</div>
		</div>
	</div>
{/if}
