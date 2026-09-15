<script lang="ts">
	import {
		Background,
		BackgroundVariant,
		Controls,
		MiniMap,
		SvelteFlow,
		useSvelteFlow
	} from '@xyflow/svelte';
	import { tick } from 'svelte';
	import type { CodingTreeState } from './codingTreeState.svelte';
	import CodeNode from './CodeNode.svelte';
	import { dropTargetId, NODE_HEIGHT, NODE_WIDTH } from './treeLayout';

	let { tree }: { tree: CodingTreeState } = $props();

	const nodeTypes = { code: CodeNode };

	/**
	 * `screenToFlowPosition` is why the canvas is its own component: the hook
	 * reads the flow's context, which only exists *below* `<SvelteFlowProvider>`,
	 * so the page that renders the provider cannot call it itself.
	 */
	const flow = useSvelteFlow();

	/**
	 * How far from a handle a connection may be released and still land on it.
	 * Wide enough that letting go anywhere on a node snaps to its handle: the
	 * handles are 8px, and asking the reader to hit one is asking them to aim
	 * rather than to say what they mean.
	 */
	const CONNECTION_RADIUS = 60;

	/**
	 * How long the viewport takes to settle after the tree has been rearranged.
	 * Long enough to read as the same tree moving rather than a new one
	 * appearing, short enough not to be waited on.
	 */
	const REFIT_MS = 250;

	/**
	 * Refit the viewport when the tree asks for it.
	 *
	 * Turning the tree on its side swaps its proportions -- a wide, shallow
	 * codebook becomes a tall, narrow one -- so whatever the reader was looking
	 * at ends up off screen at a zoom chosen for the other orientation. A new
	 * top-level code widens the tree for the same reason. The `fitView` prop only
	 * runs once, at mount, so the refit has to be asked for.
	 *
	 * Keyed on `tree.refits` and nothing else, so an ordinary edit never yanks
	 * the viewport away from what the reader is working on.
	 */
	$effect(() => {
		if (tree.refits === 0) return;
		const reduced =
			typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
		// After the nodes Svelte Flow has just been handed are measured; fitting
		// against the previous arrangement would fit the wrong bounds.
		void tick().then(() => flow.fitView({ padding: 0.12, duration: reduced ? 0 : REFIT_MS }));
	});

	/**
	 * Which node the drag is currently over, carried from the drag to the drop.
	 *
	 * Worked out here rather than taken from the event: the `targetNode` Svelte
	 * Flow passes to its drag handlers is the node *being dragged*, not the one
	 * under it, and the helper that would answer this is only reachable from
	 * inside the flow's own context.
	 */
	let hovered: string | null = null;

	/**
	 * A connection dragged from a code and let go over empty canvas.
	 *
	 * Releasing on nothing is the moment the reader has already decided a code
	 * needs something under it and is looking at the empty space where it should
	 * go, so that is where the sub-code appears -- named and ready to type into,
	 * rather than dropped and then hunted for. It is also the only way to add a
	 * code without first selecting its parent.
	 *
	 * Only from a source handle. A connection pulled from a code's *target*
	 * handle would mean "give this code a parent", which is a different edit --
	 * it has to adopt the code's current parent and slot in above it -- and
	 * guessing at it from the same gesture would make the gesture unpredictable.
	 */
	function addCodeWhereDropped(
		event: MouseEvent | TouchEvent,
		state: {
			isValid: boolean | null;
			fromNode: { id: string } | null;
			fromHandle: { type: string } | null;
		}
	) {
		if (state.isValid) return;
		if (!state.fromNode || state.fromHandle?.type !== 'source') return;

		const point = 'changedTouches' in event ? event.changedTouches[0] : event;
		const dropped = flow.screenToFlowPosition({ x: point.clientX, y: point.clientY });

		tree.addChild(state.fromNode.id, {
			// Centred on the pointer rather than starting there, so the new code
			// appears where the reader was looking. Read only under `free`; the
			// layout owns the arrangement otherwise.
			x: dropped.x - NODE_WIDTH / 2,
			y: dropped.y - NODE_HEIGHT / 2
		});
	}
</script>

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
		// Only while the layout owns the arrangement. Once the reader has broken
		// out, dragging is how they arrange the canvas, and a drag that
		// re-parented whenever two nodes happened to overlap would make the board
		// impossible to tidy.
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
		// A drag that re-parented nothing means one of two things: in `free` it is
		// where the reader wants the node, and in `auto` it is a move the layout
		// owns, so the node goes back.
		if (tree.layoutMode === 'free') tree.setPosition(dragged.id, dragged.position);
		else tree.sync();
	}}
	onconnect={({ source, target }) => {
		// Dragging a handle says "this one goes under that one" explicitly, which
		// is the only way to re-parent while the canvas is in `free` mode and
		// dragging means moving.
		if (!tree.moveUnder(target, source)) tree.sync();
	}}
	onconnectend={addCodeWhereDropped}
>
	<Background variant={BackgroundVariant.Dots} gap={18} size={1} bgColor="#f9fafb" />
	<Controls showLock={false} />
	<MiniMap
		nodeColor={(node) => (node.data as { code: { color: string } }).code.color}
		pannable
		zoomable
	/>
</SvelteFlow>
