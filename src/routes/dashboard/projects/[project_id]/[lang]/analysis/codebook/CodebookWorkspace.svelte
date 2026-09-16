<script lang="ts">
	import '@xyflow/svelte/dist/style.css';

	import { SvelteFlowProvider } from '@xyflow/svelte';
	import { toast } from 'svelte-sonner';
	import CodeInspector from './CodeInspector.svelte';
	import CodebookCanvas from './CodebookCanvas.svelte';
	import CodebookToolbar from './CodebookToolbar.svelte';
	import { displayName } from '$lib/coding/codingTree';
	import type { CodingTreeState } from '$lib/coding/codingTreeState.svelte';

	/**
	 * The canvas, its toolbar and its inspector, over a codebook it is handed.
	 *
	 * Split from the route's page so that the editor can be reasoned about --
	 * and rendered in a test -- without the loading, saving and failure states
	 * the page is responsible for. Everything here is about editing a codebook
	 * that is already in hand.
	 */
	let { tree }: { tree: CodingTreeState } = $props();

	function deleteCode(id: string) {
		const removed = tree.remove(id);
		if (!removed) return;
		// Deleting a branch takes everything under it, which is easy to do by
		// accident and expensive to retype. An undo in the toast is cheaper than
		// a confirmation dialog on every delete, and does not block the canvas
		// the way a browser dialog would.
		toast.success(
			removed.removed === 1
				? `Deleted “${displayName(removed.name)}”`
				: `Deleted “${displayName(removed.name)}” and ${removed.removed - 1} sub-code${removed.removed === 2 ? '' : 's'}`,
			{ action: { label: 'Undo', onClick: () => tree.undo() } }
		);
	}

	function onKeydown(event: KeyboardEvent) {
		const target = event.target as HTMLElement | null;
		// The inspector is full of text fields; none of these shortcuts should
		// reach the canvas while the reader is typing in one.
		if (target?.closest('input, textarea, [contenteditable="true"]')) return;

		const meta = event.metaKey || event.ctrlKey;
		if (meta && event.key.toLowerCase() === 'z') {
			event.preventDefault();
			if (event.shiftKey) tree.redo();
			else tree.undo();
			return;
		}

		const selected = tree.selectedId;
		if (!selected) return;

		// Enter and Tab are the outliner's two moves -- a sibling and a child --
		// and they are what makes it possible to type a codebook in rather than
		// reach for the toolbar between every code.
		if (event.key === 'Enter') {
			event.preventDefault();
			tree.addSibling(selected);
		} else if (event.key === 'Tab') {
			event.preventDefault();
			tree.addChild(selected);
		} else if (event.key === 'F2') {
			// The keyboard half of double-clicking a node, and the conventional
			// rename key -- without it renaming is only reachable by mouse.
			event.preventDefault();
			tree.focusName();
		} else if (event.key === 'Delete' || event.key === 'Backspace') {
			event.preventDefault();
			deleteCode(selected);
		}
	}
</script>

<svelte:window onkeydown={onKeydown} />

<!-- The provider, not `SvelteFlow` itself, is what puts the flow's context in
     scope; `CodebookCanvas` needs it to turn a pointer position into a canvas one
     when a connection is dropped on empty space. -->
<SvelteFlowProvider>
	<div
		class="flex min-h-[36rem] flex-1 overflow-hidden rounded-lg border border-gray-200 bg-gray-50"
	>
		<div class="flex min-w-0 flex-1 flex-col">
			<CodebookToolbar {tree} />

			<div class="min-h-0 flex-1">
				<CodebookCanvas {tree} />
			</div>
		</div>

		{#if tree.selected}
			<CodeInspector {tree} code={tree.selected} onDelete={deleteCode} />
		{:else}
			<aside
				class="flex h-full w-80 shrink-0 flex-col justify-center gap-3 border-l border-gray-200 bg-white px-6 text-center"
			>
				<p class="text-sm text-gray-500">Select a code to edit it.</p>
				<dl class="space-y-1 text-left text-xs text-gray-400">
					<div>
						<dt class="inline font-medium">Drag onto a code:</dt>
						make it a sub-code
					</div>
					<div>
						<dt class="inline font-medium">Drag from a handle:</dt>
						onto a code to re-parent, onto empty canvas for a new sub-code
					</div>
					<div>
						<dt class="inline font-medium">Double click a code:</dt>
						rename it
					</div>
					<div>
						<dt class="inline font-medium">Enter:</dt>
						new code beside the selected one
					</div>
					<div>
						<dt class="inline font-medium">Tab:</dt>
						new sub-code under it
					</div>
					<div>
						<dt class="inline font-medium">Delete:</dt>
						remove it and its sub-codes
					</div>
				</dl>
			</aside>
		{/if}
	</div>
</SvelteFlowProvider>
