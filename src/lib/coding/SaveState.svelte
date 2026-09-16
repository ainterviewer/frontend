<script lang="ts">
	import type { Codebook } from './store.svelte';

	/**
	 * Whether the codebook in front of the reader is the codebook on the server.
	 *
	 * Small and quiet while that is true, because it almost always is. It stops
	 * being quiet only when a write failed, which is the one state the reader
	 * has to act on: their last change exists nowhere but this tab.
	 */
	let { book }: { book: Codebook } = $props();
</script>

{#if book.error && book.status === 'ready'}
	<span class="inline-flex items-center gap-1.5 text-xs text-red-600">
		<i class="fas fa-triangle-exclamation"></i>
		{book.error}
		<button
			type="button"
			class="cursor-pointer underline underline-offset-2 hover:no-underline"
			onclick={() => book.flush()}
		>
			Retry
		</button>
	</span>
{:else if book.saving || book.dirty}
	<span class="inline-flex items-center gap-1.5 text-xs text-gray-400">
		<i class="fas fa-circle-notch animate-spin"></i>
		Saving…
	</span>
{:else}
	<span class="inline-flex items-center gap-1.5 text-xs text-gray-400">
		<i class="fas fa-cloud-check"></i>
		Saved
	</span>
{/if}
