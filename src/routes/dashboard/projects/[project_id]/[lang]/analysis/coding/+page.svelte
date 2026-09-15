<script lang="ts">
	import '@xyflow/svelte/dist/style.css';

	import { Background, BackgroundVariant, Controls, MiniMap, SvelteFlow } from '@xyflow/svelte';
	import { toast } from 'svelte-sonner';
	import CodeInspector from './CodeInspector.svelte';
	import CodeNode from './CodeNode.svelte';
	import CodingToolbar from './CodingToolbar.svelte';
	import { CodingTreeState } from './codingTreeState.svelte';
	import { displayName } from './codingTree';
	import { dropTargetId } from './treeLayout';

	const tree = new CodingTreeState();

	const nodeTypes = { code: CodeNode };

	/**
	 * How far from a handle a connection may be released and still land on it.
	 * Wide enough that letting go anywhere on a node snaps to its handle: the
	 * handles are 8px, and asking the reader to hit one is asking them to aim
	 * rather than to say what they mean.
	 */
	const CONNECTION_RADIUS = 60;

	/**
	 * Which node the drag is currently over, carried from the drag to the drop.
	 *
	 * Worked out here rather than taken from the event: the `targetNode` Svelte
	 * Flow passes to its drag handlers is the node *being dragged*, not the one
	 * under it, and the helper that would answer this is only reachable from
	 * inside the flow's own context.
	 */
	let hovered: string | null = null;

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
		} else if (event.key === 'Delete' || event.key === 'Backspace') {
			event.preventDefault();
			deleteCode(selected);
		}
	}
</script>

<svelte:window onkeydown={onKeydown} />

<div class="flex min-h-0 w-full flex-1 flex-col">
	<header class="mb-4">
		<h1 class="page-title">Coding tree</h1>
		<p class="max-w-2xl text-sm text-gray-500">
			The project's codebook as a tree. Drag a code onto another to make it a sub-code, or drag from
			a code's handle to the one it should sit under. Select a code to write its definition and
			memo.
		</p>
	</header>

	<div
		class="flex min-h-[36rem] flex-1 overflow-hidden rounded-lg border border-gray-200 bg-gray-50"
	>
		<div class="flex min-w-0 flex-1 flex-col">
			<CodingToolbar {tree} />

			<div class="min-h-0 flex-1">
				<SvelteFlow
					bind:nodes={tree.nodes}
					bind:edges={tree.edges}
					{nodeTypes}
					fitView
					fitViewOptions={{ padding: 0.12 }}
					minZoom={0.2}
					maxZoom={1.75}
					nodesConnectable
					elevateNodesOnSelect
					connectionRadius={CONNECTION_RADIUS}
					deleteKey={null}
					onnodeclick={({ node }) => (tree.selectedId = node.id)}
					onpaneclick={() => (tree.selectedId = null)}
					onnodedrag={({ nodes }) => {
						const dragged = nodes[0];
						if (!dragged) return;
						// Only while the layout owns the arrangement. Once the reader
						// has broken out, dragging is how they arrange the canvas, and
						// a drag that re-parented whenever two nodes happened to
						// overlap would make the board impossible to tidy.
						hovered = tree.layoutMode === 'auto' ? dropTargetId(dragged, tree.nodes) : null;
						tree.markDropTarget(dragged.id, hovered);
					}}
					onnodedragstop={({ nodes }) => {
						const dragged = nodes[0];
						tree.clearDropTarget();
						if (!dragged) return;
						const target = hovered;
						hovered = null;
						if (target && tree.moveUnder(dragged.id, target)) return;
						// A drag that re-parented nothing means one of two things: in
						// `free` it is where the reader wants the node, and in `auto`
						// it is a move the layout owns, so the node goes back.
						if (tree.layoutMode === 'free') tree.setPosition(dragged.id, dragged.position);
						else tree.sync();
					}}
					onconnect={({ source, target }) => {
						// Dragging a handle says "this one goes under that one"
						// explicitly, which is the only way to re-parent while the
						// canvas is in `free` mode and dragging means moving.
						if (!tree.moveUnder(target, source)) tree.sync();
					}}
				>
					<Background variant={BackgroundVariant.Dots} gap={18} size={1} bgColor="#f9fafb" />
					<Controls showLock={false} />
					<MiniMap
						nodeColor={(node) => (node.data as { code: { color: string } }).code.color}
						pannable
						zoomable
					/>
				</SvelteFlow>
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
						<dt class="inline font-medium">Drag onto a code</dt>
						— make it a sub-code
					</div>
					<div>
						<dt class="inline font-medium">Enter</dt>
						— new code beside the selected one
					</div>
					<div>
						<dt class="inline font-medium">Tab</dt>
						— new sub-code under it
					</div>
					<div>
						<dt class="inline font-medium">Delete</dt>
						— remove it and its sub-codes
					</div>
				</dl>
			</aside>
		{/if}
	</div>
</div>
