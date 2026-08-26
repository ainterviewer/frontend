<script lang="ts">
	import type { TemplatePlaceholder } from '$lib/api/types.gen';
	import {
		PLACEHOLDER_LABELS,
		placeholderText,
		URL_PLACEHOLDER_HINTS,
		URL_PLACEHOLDER_KEYS
	} from '$lib/tiptap/placeholders';
	import { fly } from 'svelte/transition';

	interface Props {
		show: boolean;
		href?: string;
		onSubmit: (href: string) => void;
		onRemove: () => void;
		onClose: () => void;
	}

	let { show = false, href = '', onSubmit, onRemove, onClose }: Props = $props();

	type Mode = 'custom' | TemplatePlaceholder;

	let mode = $state<Mode>('custom');
	let customUrl = $state('');
	let input = $state<HTMLInputElement | null>(null);

	// Re-seed every time the modal opens, not on every keystroke. A href that is
	// exactly a placeholder is a chosen personal link; anything else is custom.
	$effect(() => {
		if (!show) return;
		const matched = URL_PLACEHOLDER_KEYS.find((key) => href.trim() === placeholderText(key));
		mode = matched ?? 'custom';
		customUrl = matched ? '' : href;
		if (!matched) queueMicrotask(() => input?.focus());
	});

	function choose(next: Mode) {
		mode = next;
		if (next === 'custom') queueMicrotask(() => input?.focus());
	}

	function submit(event: SubmitEvent) {
		event.preventDefault();
		if (mode !== 'custom') {
			onSubmit(placeholderText(mode));
			return;
		}
		const trimmed = customUrl.trim();
		if (!trimmed) {
			onRemove();
			return;
		}
		onSubmit(trimmed);
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && show) onClose();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if show}
	<div
		class="fixed inset-0 z-200 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		aria-labelledby="editor-link-title"
	>
		<div
			class="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
			in:fly={{ y: 20, duration: 200 }}
			out:fly={{ y: 20, duration: 200 }}
		>
			<form class="px-6 py-6 sm:p-8" onsubmit={submit}>
				<h2 id="editor-link-title" class="text-xl font-bold tracking-tight text-gray-900">
					{href ? 'Edit link' : 'Add link'}
				</h2>
				<p class="mt-1 text-sm text-gray-600">
					Point the link at a fixed address, or at a placeholder that resolves to each participant's
					personal URL.
				</p>

				<fieldset class="mt-5">
					<legend class="text-sm font-medium text-gray-700">Link to</legend>
					<div class="mt-2 flex flex-wrap gap-2">
						<button
							type="button"
							class="rounded-full border px-3 py-1.5 text-sm font-medium transition-colors"
							class:border-primary={mode === 'custom'}
							class:bg-primary={mode === 'custom'}
							class:text-white={mode === 'custom'}
							class:border-gray-300={mode !== 'custom'}
							class:bg-white={mode !== 'custom'}
							class:text-gray-700={mode !== 'custom'}
							class:hover:bg-gray-50={mode !== 'custom'}
							aria-pressed={mode === 'custom'}
							onclick={() => choose('custom')}
						>
							<i class="fa-solid fa-globe mr-1.5 text-xs" aria-hidden="true"></i>
							A fixed address
						</button>
						{#each URL_PLACEHOLDER_KEYS as key (key)}
							<button
								type="button"
								class="rounded-full border px-3 py-1.5 text-sm font-medium transition-colors"
								class:border-primary={mode === key}
								class:bg-primary={mode === key}
								class:text-white={mode === key}
								class:border-gray-300={mode !== key}
								class:bg-white={mode !== key}
								class:text-gray-700={mode !== key}
								class:hover:bg-gray-50={mode !== key}
								aria-pressed={mode === key}
								onclick={() => choose(key)}
							>
								<i class="fa-solid fa-link mr-1.5 text-xs" aria-hidden="true"></i>
								{PLACEHOLDER_LABELS[key]}
							</button>
						{/each}
					</div>
				</fieldset>

				<label for="editor-link-url" class="mt-5 block text-sm font-medium text-gray-700">URL</label
				>
				{#if mode === 'custom'}
					<input
						bind:this={input}
						bind:value={customUrl}
						id="editor-link-url"
						type="text"
						class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none"
						placeholder="https://example.org"
						autocomplete="off"
					/>
				{:else}
					<input
						id="editor-link-url"
						type="text"
						class="mt-1 w-full cursor-not-allowed rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
						value={URL_PLACEHOLDER_HINTS[mode] ?? PLACEHOLDER_LABELS[mode]}
						disabled
					/>
				{/if}

				<div class="mt-6 flex items-center justify-between gap-3">
					<button
						type="button"
						class="rounded-full px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
						onclick={onRemove}
						disabled={!href}
					>
						Remove link
					</button>
					<div class="flex gap-2">
						<button
							type="button"
							class="rounded-full bg-gray-100 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
							onclick={onClose}
						>
							Cancel
						</button>
						<button
							type="submit"
							class="rounded-full bg-primary px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-dark"
						>
							{href ? 'Update' : 'Add link'}
						</button>
					</div>
				</div>
			</form>
		</div>
	</div>
{/if}
