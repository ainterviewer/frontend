<script module lang="ts">
	/** Styles for the fields inside the dialogs, so they all read alike. */
	export const labelClass = 'mb-1.5 block text-sm font-medium text-gray-700';
	export const inputClass =
		'box-border h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm placeholder:text-gray-400 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none';
</script>

<script lang="ts">
	import { Dialog } from 'bits-ui';
	import type { Snippet } from 'svelte';
	import { fade, fly } from 'svelte/transition';

	interface Props {
		title: string;
		/** A line under the title: what the dialog does, or to what. */
		description?: string | Snippet;
		/** Deleting or leaving: a warning mark, and a red submit button. */
		danger?: boolean;
		/** Room for a list of collaborators. */
		wide?: boolean;
		submitLabel: string;
		canSubmit?: boolean;
		/** Runs on the submit button or Enter; the button spins until it settles. */
		onSubmit: () => unknown;
		onClose: () => void;
		children: Snippet;
	}

	let {
		title,
		description,
		danger = false,
		wide = false,
		submitLabel,
		canSubmit = true,
		onSubmit,
		onClose,
		children
	}: Props = $props();

	let busy = $state(false);

	// Start in the first field rather than on ✕, the first thing that takes
	// focus; a dialog without a field keeps bits-ui's default.
	function focusFirstField(event: Event) {
		const field = document.querySelector<HTMLElement>(
			'[data-dashboard-dialog] input:not([type="hidden"])'
		);
		if (!field) return;
		event.preventDefault();
		field.focus();
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (!canSubmit || busy) return;
		busy = true;
		try {
			await onSubmit();
		} finally {
			busy = false;
		}
	}
</script>

<!-- The frame the dashboard's dialogs share. The page mounts a dialog to open
     it and unmounts it to close it, so the root is always open here; closing
     from inside (Escape, the backdrop, ✕, Cancel) asks the page to unmount it. -->
<Dialog.Root
	open
	onOpenChange={(open) => {
		if (!open && !busy) onClose();
	}}
>
	<Dialog.Portal>
		<Dialog.Overlay forceMount class="fixed inset-0 z-1000 bg-black/50 backdrop-blur-sm">
			{#snippet child({ props, open })}
				{#if open}
					<div {...props} transition:fade={{ duration: 150 }}></div>
				{/if}
			{/snippet}
		</Dialog.Overlay>
		<Dialog.Content
			forceMount
			data-dashboard-dialog
			onOpenAutoFocus={focusFirstField}
			class={[
				'fixed top-1/2 left-1/2 z-1000 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl bg-white shadow-xl focus:outline-none',
				wide ? 'max-w-xl' : 'max-w-md'
			]}
		>
			{#snippet child({ props, open })}
				{#if open}
					<div {...props} transition:fly={{ y: 8, duration: 150 }}>
						<form onsubmit={submit}>
							<div class="flex items-start gap-3 px-5 pt-5">
								{#if danger}
									<span
										class="flex size-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600"
									>
										<i class="fa-solid fa-triangle-exclamation"></i>
									</span>
								{/if}
								<div class="min-w-0 flex-1">
									<Dialog.Title class="text-lg font-semibold text-dark">{title}</Dialog.Title>
									{#if description}
										<Dialog.Description class="mt-1 text-sm text-gray-500">
											{#if typeof description === 'string'}
												{description}
											{:else}
												{@render description()}
											{/if}
										</Dialog.Description>
									{/if}
								</div>
								<Dialog.Close
									type="button"
									class="-mt-1 -mr-1 rounded p-1 text-gray-400 hover:text-gray-600 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
									aria-label="Close"
								>
									<i class="fa-solid fa-xmark text-lg"></i>
								</Dialog.Close>
							</div>

							<div class="space-y-4 px-5 py-5">
								{@render children()}
							</div>

							<div
								class="flex justify-end gap-2 rounded-b-xl border-t border-gray-100 bg-gray-50 px-5 py-3"
							>
								<Dialog.Close
									type="button"
									class="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"
								>
									Cancel
								</Dialog.Close>
								<button
									type="submit"
									class={[
										'flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50',
										danger ? 'bg-red-600 hover:bg-red-700' : 'bg-primary hover:bg-dark'
									]}
									disabled={!canSubmit || busy}
								>
									{#if busy}
										<i class="fa-solid fa-spinner fa-spin"></i>
									{/if}
									{submitLabel}
								</button>
							</div>
						</form>
					</div>
				{/if}
			{/snippet}
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
