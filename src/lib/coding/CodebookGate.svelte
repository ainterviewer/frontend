<script lang="ts">
	import type { Snippet } from 'svelte';

	import type { CodingTreeState } from './codingTreeState.svelte';
	import type { Codebook } from './store.svelte';

	/**
	 * Holds a view back until the project's codebook has been read, and keeps
	 * writing it afterwards.
	 *
	 * The waiting is not politeness: an editor opened on an empty codebook is
	 * indistinguishable from one opened on a codebook that *is* empty, and the
	 * reader's first keystroke would save the emptiness over their codes.
	 *
	 * The saving lives here because `Codebook` outlives every component that
	 * reads it, so it cannot own the effect that watches the tree -- an effect
	 * created outside a component has no owner to be destroyed with. Any number
	 * of gates may be mounted on one codebook at once; they all call the same
	 * debounce.
	 */
	let { book, children }: { book: Codebook; children: Snippet<[CodingTreeState]> } = $props();

	$effect(() => {
		book.sync(book.tree.revision);
	});
</script>

{#if book.status === 'loading'}
	<div class="flex min-h-[20rem] flex-1 items-center justify-center text-sm text-gray-400">
		<i class="fas fa-circle-notch mr-2 animate-spin"></i>
		Loading codebook…
	</div>
{:else if book.status === 'error'}
	<div
		class="flex min-h-[20rem] flex-1 flex-col items-center justify-center gap-3 text-center text-sm"
	>
		<p class="text-gray-600">{book.error}</p>
		<button
			type="button"
			class="cursor-pointer rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
			onclick={() => book.read()}
		>
			Try again
		</button>
	</div>
{:else}
	{@render children(book.tree)}
{/if}
