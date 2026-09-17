<script lang="ts">
	import type { Codebook } from './store.svelte';

	/**
	 * Whether the codebook in front of the reader is the codebook on the server.
	 *
	 * Small and quiet while that is true, because it almost always is. It stops
	 * being quiet only when a write failed, which is the one state the reader
	 * has to act on: their last change exists nowhere but this tab.
	 *
	 * Every state is drawn as a `flex` row of one fixed height, with the icon in a
	 * column of its own. Deliberately not `inline-flex`: an inline-level box takes
	 * part in the line it sits on, and an inline flex container's baseline is its
	 * first item's -- the icon. The three glyphs are different heights, so the
	 * whole indicator shifted down the line the moment a save swapped one icon for
	 * another.
	 */
	let { book }: { book: Codebook } = $props();
</script>

{#if book.error && book.status === 'ready'}
	<span class="flex h-4 items-center gap-1.5 text-xs leading-none text-red-600">
		<i class="fas fa-triangle-exclamation w-3 text-center"></i>
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
	<span class="flex h-4 items-center gap-1.5 text-xs leading-none text-gray-400">
		<i class="fas fa-circle-notch w-3 animate-spin text-center"></i>
		Saving…
	</span>
{:else}
	<span class="flex h-4 items-center gap-1.5 text-xs leading-none text-gray-400">
		<i class="fas fa-cloud-check w-3 text-center"></i>
		Saved
	</span>
{/if}
