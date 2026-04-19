<script lang="ts">
	import { toast } from 'svelte-sonner';

	let {
		open = $bindable(),
		title = 'Generate',
		description = '',
		onGenerate,
		placeholder = 'Describe what you want to generate...'
	} = $props<{
		open: boolean;
		title?: string;
		description?: string;
		onGenerate: (prompt: string) => Promise<void>;
		placeholder?: string;
	}>();

	let generatePrompt = $state('');
	let generating = $state(false);
	let textareaEl: HTMLTextAreaElement | undefined = $state();

	async function handleGenerate() {
		generating = true;
		try {
			await onGenerate(generatePrompt);
			open = false;
			generatePrompt = '';
		} catch (e) {
			console.error('Failed to generate', e);
			toast.error('Failed to generate. Please try again.');
		} finally {
			generating = false;
		}
	}

	function close() {
		if (generating) return;
		open = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') close();
		if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && generatePrompt.trim() && !generating) {
			e.preventDefault();
			handleGenerate();
		}
	}

	$effect(() => {
		if (open) {
			queueMicrotask(() => textareaEl?.focus());
		}
	});
</script>

<svelte:window onkeydown={open ? handleKeydown : undefined} />

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		aria-labelledby="generate-modal-title"
	>
		<button
			type="button"
			class="absolute inset-0 cursor-default"
			aria-label="Close modal"
			onclick={close}
			tabindex="-1"
		></button>

		<div
			class="animate-in fade-in zoom-in-95 relative w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5 duration-150"
		>
			<!-- Header -->
			<div class="flex items-start justify-between gap-4 px-6 pt-5 pb-4">
				<div class="flex items-start gap-3">
					<div
						class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
					>
						<i class="fa-solid fa-wand-magic-sparkles"></i>
					</div>
					<div>
						<h3 id="generate-modal-title" class="text-base font-semibold text-gray-900">
							{title}
						</h3>
						{#if description}
							<p class="mt-1 text-sm text-gray-500">{description}</p>
						{/if}
					</div>
				</div>
				<button
					type="button"
					class="-mt-1 -mr-1 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
					onclick={close}
					aria-label="Close modal"
				>
					<i class="fa-solid fa-xmark"></i>
				</button>
			</div>

			<!-- Body -->
			<div class="px-6 pb-2">
				<label class="mb-1.5 block text-sm font-medium text-gray-700" for="prompt">Prompt</label>
				<textarea
					bind:this={textareaEl}
					id="prompt"
					class="h-36 w-full resize-none rounded-lg border border-gray-300 bg-gray-50 p-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/30 focus:outline-none"
					{placeholder}
					bind:value={generatePrompt}
				></textarea>
				<p class="mt-2 text-xs text-gray-400">
					Tip: press <kbd
						class="rounded border border-gray-200 bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] text-gray-600"
						>⌘</kbd
					>
					<kbd
						class="rounded border border-gray-200 bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] text-gray-600"
						>Enter</kbd
					> to generate
				</p>
			</div>

			<!-- Footer -->
			<div class="mt-4 flex justify-end gap-2 border-t border-gray-100 bg-gray-50/60 px-6 py-3">
				<button
					type="button"
					class="cursor-pointer rounded-lg px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
					onclick={close}
					disabled={generating}
				>
					Cancel
				</button>
				<button
					type="button"
					class="flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-dark disabled:cursor-not-allowed disabled:opacity-50"
					onclick={handleGenerate}
					disabled={generating || !generatePrompt.trim()}
				>
					{#if generating}
						<i class="fa-solid fa-spinner fa-spin"></i> Generating...
					{:else}
						<i class="fa-solid fa-wand-magic-sparkles"></i> Generate
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}
