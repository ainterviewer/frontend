import dagre from '@dagrejs/dagre';
import { childrenOf, type Code, type CodeId, type XY } from './codingTree';

/**
 * Where the canvas puts each code when it is laying the tree out itself.
 *
 * Dagre rather than a hand-rolled tidy-tree walk: the codebook is a tree today,
 * but the thing it wants to become -- a code appearing under two parents,
 * cross-links between branches -- is a DAG, and a bespoke walk would have to be
 * thrown away the day that lands. It also gets edge routing and both
 * orientations for nothing.
 *
 * Node size is fixed rather than measured. Measuring would mean laying out
 * after the nodes have been drawn, which is a render, a measure and a second
 * render on every edit; a codebook node is a label and a count, so a fixed box
 * costs nothing but a clamped label and keeps layout a pure function of the
 * codes.
 */

/** Read by `CodeNode.svelte` too: the box dagre reserves has to be the box drawn. */
export const NODE_WIDTH = 216;
// Two clamped lines of the name plus the meta row beneath it. Anything less
// and a two-line code name is cut through the middle of its second line.
export const NODE_HEIGHT = 76;

/** Top-to-bottom reads as a hierarchy; left-to-right fits deep, narrow books. */
export type LayoutDirection = 'TB' | 'LR';

/** Gap between siblings, and between one level and the next. */
const NODE_GAP = 26;
const RANK_GAP = 64;

export function layoutCodes(codes: readonly Code[], direction: LayoutDirection): Map<CodeId, XY> {
	const graph = new dagre.graphlib.Graph();
	graph.setGraph({
		rankdir: direction,
		nodesep: NODE_GAP,
		ranksep: RANK_GAP,
		marginx: 32,
		marginy: 32
	});
	// Codes carry no edge data, so every edge is the same empty object.
	graph.setDefaultEdgeLabel(() => ({}));

	for (const code of codes) {
		graph.setNode(code.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
	}
	for (const code of codes) {
		if (code.parentId !== null) graph.setEdge(code.parentId, code.id);
	}

	dagre.layout(graph);

	const positions = new Map<CodeId, XY>();
	for (const code of codes) {
		const node = graph.node(code.id);
		if (!node) continue;
		// Dagre positions a node by its centre; Svelte Flow by its top-left.
		positions.set(code.id, { x: node.x - NODE_WIDTH / 2, y: node.y - NODE_HEIGHT / 2 });
	}
	return positions;
}

/**
 * Where a code should sit given the current mode.
 *
 * Under `free` a code that has never been dragged still has to go somewhere, so
 * it falls back to the computed layout. That is what makes the two modes a
 * toggle rather than two documents: breaking out of `auto` leaves everything
 * exactly where it already was, and only what the reader then drags differs.
 */
export function resolvePositions(
	codes: readonly Code[],
	direction: LayoutDirection,
	mode: 'auto' | 'free'
): Map<CodeId, XY> {
	const computed = layoutCodes(codes, direction);
	if (mode === 'auto') return computed;
	const resolved = new Map<CodeId, XY>();
	for (const code of codes) {
		resolved.set(code.id, code.position ?? computed.get(code.id) ?? { x: 0, y: 0 });
	}
	return resolved;
}

/**
 * A freshly created code's position, for the `free` mode where nothing will
 * lay it out: one rank on from its parent, nudged past any siblings already
 * there, so it appears somewhere the reader is looking rather than at the
 * origin.
 *
 * Direction-aware, because "one rank on" is downwards under `TB` and rightwards
 * under `LR`; placing a code below its parent on a tree that runs across the
 * page drops it into the middle of the branch beneath.
 */
export function placeNewCode(
	codes: readonly Code[],
	parentId: CodeId | null,
	positions: Map<CodeId, XY>,
	direction: LayoutDirection
): XY {
	const siblings = childrenOf(codes, parentId);
	const anchor = parentId === null ? null : positions.get(parentId);
	const base = anchor ?? { x: 0, y: 0 };
	// A root has no parent to sit under, so it goes beside the roots already
	// there -- along the axis siblings are spread on, whichever that is.
	const alongSiblings =
		siblings.length * (direction === 'LR' ? NODE_HEIGHT + NODE_GAP : NODE_WIDTH + NODE_GAP);
	const rank = direction === 'LR' ? NODE_WIDTH + RANK_GAP : NODE_HEIGHT + RANK_GAP;
	if (direction === 'LR') {
		return {
			x: base.x + (parentId === null ? 0 : rank),
			y: base.y + alongSiblings
		};
	}
	return {
		x: base.x + (parentId === null ? alongSiblings : siblings.length * 40),
		y: base.y + (parentId === null ? 0 : rank)
	};
}

/**
 * Which node a dragged node is being held over.
 *
 * Svelte Flow does not answer this: the `targetNode` its drag events carry is
 * the node *being dragged*, and `getIntersectingNodes` is only reachable from
 * inside the flow's own context. Both nodes are a known fixed size in flow
 * coordinates, though, so the overlap is just arithmetic -- and arithmetic can
 * be tested without a browser.
 *
 * The winner is whichever node is covered most, and only once a real part of it
 * is covered: a target that lights up when a corner grazes it makes dropping
 * feel like a guess, and at this node size a small overlap is usually the
 * reader on their way somewhere else.
 */
const MIN_OVERLAP = 0.25;

export function dropTargetId(
	dragged: { id: CodeId; position: XY },
	others: readonly { id: CodeId; position: XY }[]
): CodeId | null {
	const area = NODE_WIDTH * NODE_HEIGHT;
	let best: CodeId | null = null;
	let bestOverlap = MIN_OVERLAP;

	for (const other of others) {
		if (other.id === dragged.id) continue;
		const dx =
			Math.min(dragged.position.x + NODE_WIDTH, other.position.x + NODE_WIDTH) -
			Math.max(dragged.position.x, other.position.x);
		const dy =
			Math.min(dragged.position.y + NODE_HEIGHT, other.position.y + NODE_HEIGHT) -
			Math.max(dragged.position.y, other.position.y);
		if (dx <= 0 || dy <= 0) continue;
		const overlap = (dx * dy) / area;
		if (overlap > bestOverlap) {
			best = other.id;
			bestOverlap = overlap;
		}
	}
	return best;
}
