import type { Edge, Node } from '@xyflow/svelte';
import {
	addCode,
	ancestorsOf,
	canReparent,
	childrenOf,
	createCode,
	descendantIds,
	findCode,
	nextRootColor,
	recolorSubtree,
	removeSubtree,
	reparent,
	subtreeOf,
	updateCode,
	type Code,
	type CodeId,
	type XY
} from './codingTree';
import { seedCodes } from './seed';
import { placeNewCode, resolvePositions, type LayoutDirection } from './treeLayout';

/**
 * The editor's state: the codebook, what is selected, and the canvas the two
 * are drawn as.
 *
 * The codes are the document; `nodes` and `edges` are a projection of them for
 * Svelte Flow. They are held rather than derived because Svelte Flow writes
 * back into the arrays it is given -- selection, drag positions, measured sizes
 * -- and a `$derived` cannot be bound. So every edit goes through a method
 * here, which rewrites the codes and then rebuilds the projection in one step.
 * Nothing outside this class mutates `codes`.
 *
 * There is no backend yet. `codes` is the whole store, and a reload is a reset;
 * when the API lands, the mutators below are the only places that have to learn
 * to persist.
 */

export type CodeNodeData = {
	code: Code;
	/** Drawn on the node, and what makes a collapsed branch legible. */
	childCount: number;
	depth: number;
	/**
	 * Which way the tree runs. Carried on the node so its handles sit on the
	 * edges the layout actually joins -- top and bottom, or left and right.
	 */
	direction: LayoutDirection;
	/**
	 * What would happen if the dragged node were dropped here. Set during a
	 * drag so the node can say whether the move is allowed *before* the reader
	 * lets go, which is the only moment the answer is useful.
	 */
	drop: 'none' | 'valid' | 'invalid';
};

export type CodeNode = Node<CodeNodeData, 'code'>;

export type LayoutMode = 'auto' | 'free';

/** How many steps back the reader can go. Deep enough to cover a misdrag. */
const HISTORY_LIMIT = 50;

export class CodingTreeState {
	#codes = $state.raw<Code[]>(seedCodes());
	#past: Code[][] = [];
	#future: Code[][] = [];
	/** What the last commit was, so consecutive keystrokes can share an entry. */
	#lastEdit: string | null = null;

	layoutMode = $state<LayoutMode>('auto');
	direction = $state<LayoutDirection>('TB');
	selectedId = $state<CodeId | null>(null);

	nodes = $state.raw<CodeNode[]>([]);
	edges = $state.raw<Edge[]>([]);

	/** The node under the pointer mid-drag, and whether dropping there is legal. */
	#dragging: CodeId | null = null;

	constructor() {
		this.sync();
	}

	get codes(): readonly Code[] {
		return this.#codes;
	}

	get selected(): Code | undefined {
		return findCode(this.#codes, this.selectedId);
	}

	get canUndo(): boolean {
		return this.#past.length > 0;
	}

	get canRedo(): boolean {
		return this.#future.length > 0;
	}

	childrenOf(id: CodeId | null): Code[] {
		return childrenOf(this.#codes, id);
	}

	/** Parent first, then upwards -- the breadcrumb the inspector draws. */
	ancestorsOf(id: CodeId): Code[] {
		return ancestorsOf(this.#codes, id);
	}

	// --- editing -------------------------------------------------------------

	/**
	 * Applies an edit and makes it undoable.
	 *
	 * Position changes do not come through here: dragging a node is a view
	 * adjustment rather than a change to the codebook, and putting every drag on
	 * the stack would bury the edit the reader actually wants back.
	 *
	 * `edit` names what is being changed, e.g. `name:code-3`. Consecutive
	 * commits carrying the same name share one history entry, so typing a code's
	 * name is one undo rather than one per keystroke.
	 */
	#commit(next: Code[], edit: string | null = null) {
		if (next === this.#codes) return;
		if (edit === null || edit !== this.#lastEdit) {
			this.#past.push(this.#codes);
			if (this.#past.length > HISTORY_LIMIT) this.#past.shift();
		}
		this.#lastEdit = edit;
		this.#future = [];
		this.#codes = next;
		this.sync();
	}

	/**
	 * Ends the current run of coalesced edits, so the next keystroke starts a
	 * fresh undo entry. Called when the field being typed into loses focus.
	 */
	endEdit() {
		this.#lastEdit = null;
	}

	/**
	 * `at` is where the reader put it -- a connection dropped on empty canvas
	 * names a position the way a toolbar click cannot. Without one the code is
	 * placed below its parent. Either way the position is only read under `free`;
	 * the layout owns the arrangement otherwise.
	 */
	addChild(parentId: CodeId | null, at?: XY): CodeId {
		const parent = findCode(this.#codes, parentId);
		const code = createCode({
			parentId,
			name: parent ? 'New sub-code' : 'New code',
			color: parent ? parent.color : nextRootColor(this.#codes),
			position: at ?? placeNewCode(this.#codes, parentId, this.#positions())
		});
		this.#commit(addCode(this.#codes, code));
		this.selectedId = code.id;
		return code.id;
	}

	/** A sibling of `id`, i.e. a child of its parent. */
	addSibling(id: CodeId): CodeId {
		return this.addChild(findCode(this.#codes, id)?.parentId ?? null);
	}

	/**
	 * `edit` groups a run of keystrokes into one undo step; leave it off for a
	 * single discrete change.
	 */
	patch(id: CodeId, fields: Partial<Omit<Code, 'id' | 'parentId'>>, edit?: string) {
		this.#commit(updateCode(this.#codes, id, fields), edit ?? null);
	}

	/**
	 * Recolours a code and everything under it, so a branch keeps reading as one
	 * thing. Recolouring a leaf is just the leaf.
	 */
	recolorBranch(id: CodeId, color: string) {
		this.#commit(recolorSubtree(this.#codes, id, color));
	}

	/** Deletes a code and its subtree. Returns what was deleted, for the undo toast. */
	remove(id: CodeId): { name: string; removed: number } | null {
		const code = findCode(this.#codes, id);
		if (!code) return null;
		const removed = subtreeOf(this.#codes, id).length;
		const parentId = code.parentId;
		this.#commit(removeSubtree(this.#codes, id));
		this.selectedId = parentId;
		return { name: code.name, removed };
	}

	canMoveUnder(id: CodeId, parentId: CodeId | null): boolean {
		return canReparent(this.#codes, id, parentId);
	}

	/**
	 * Moves a code, and repaints it into the branch it lands in.
	 *
	 * The colour means "this is one branch", so a code that keeps its old hue
	 * after a move is actively misleading -- it goes on claiming kinship with the
	 * branch it just left. Promoting to the top level makes it a branch of its
	 * own, so it takes a fresh palette hue rather than the one it inherited.
	 *
	 * This does overwrite a colour the reader set by hand on a sub-branch. That
	 * is the trade: under this scheme colour is a property of where a code sits,
	 * and a hand-set hue on a code that then moves is a statement about a place
	 * it no longer occupies. The move and the repaint are one commit, so a single
	 * undo takes back both.
	 */
	moveUnder(id: CodeId, parentId: CodeId | null): boolean {
		if (!this.canMoveUnder(id, parentId)) return false;
		const moved = reparent(this.#codes, id, parentId);
		const parent = findCode(moved, parentId);
		// Picked from the codebook *without* the moved branch: counting its own
		// current hue would bias the choice towards the colour it is leaving.
		const color = parent ? parent.color : nextRootColor(removeSubtree(moved, id));
		this.#commit(recolorSubtree(moved, id, color));
		return true;
	}

	undo() {
		this.#lastEdit = null;
		const previous = this.#past.pop();
		if (!previous) return;
		this.#future.push(this.#codes);
		this.#codes = previous;
		if (this.selectedId && !findCode(previous, this.selectedId)) this.selectedId = null;
		this.sync();
	}

	redo() {
		this.#lastEdit = null;
		const next = this.#future.pop();
		if (!next) return;
		this.#past.push(this.#codes);
		this.#codes = next;
		this.sync();
	}

	// --- layout --------------------------------------------------------------

	#positions(): Map<CodeId, XY> {
		return resolvePositions(this.#codes, this.direction, this.layoutMode);
	}

	/**
	 * Switching to `free` freezes the computed layout onto the codes first, so
	 * breaking out changes nothing on screen: the reader keeps the arrangement
	 * they were looking at and moves what they want from there. Switching back
	 * to `auto` leaves those positions in place, unread, so a round trip does
	 * not cost the reader their hand-made layout.
	 */
	setLayoutMode(mode: LayoutMode) {
		if (mode === this.layoutMode) return;
		if (mode === 'free') {
			const computed = this.#positions();
			this.#codes = this.#codes.map((code) => ({
				...code,
				position: code.position ?? computed.get(code.id) ?? { x: 0, y: 0 }
			}));
		}
		this.layoutMode = mode;
		this.sync();
	}

	setDirection(direction: LayoutDirection) {
		if (direction === this.direction) return;
		this.direction = direction;
		this.sync();
	}

	/** Forgets every hand-placed position and lets the layout take over again. */
	resetPositions() {
		this.#codes = this.#codes.map((code) => ({ ...code, position: null }));
		this.layoutMode = 'auto';
		this.sync();
	}

	/** A drag in `free` mode. Not undoable -- see `#commit`. */
	setPosition(id: CodeId, position: XY) {
		if (this.layoutMode !== 'free') return;
		this.#codes = this.#codes.map((code) => (code.id === id ? { ...code, position } : code));
	}

	// --- dragging ------------------------------------------------------------

	/**
	 * Marks the node a drag is hovering, so the canvas can show whether letting
	 * go would re-parent or be refused. Kept here rather than in the page so the
	 * node projection is rebuilt the one way.
	 */
	markDropTarget(draggedId: CodeId, targetId: CodeId | null) {
		if (this.#dragging === targetId) return;
		this.#dragging = targetId;
		const forbidden = descendantIds(this.#codes, draggedId);
		this.nodes = this.nodes.map((node) => {
			const drop: CodeNodeData['drop'] =
				node.id !== targetId
					? 'none'
					: node.id === draggedId || forbidden.has(node.id)
						? 'invalid'
						: this.canMoveUnder(draggedId, node.id)
							? 'valid'
							: 'invalid';
			return node.data.drop === drop ? node : { ...node, data: { ...node.data, drop } };
		});
	}

	clearDropTarget() {
		if (this.#dragging === null) return;
		this.#dragging = null;
		this.nodes = this.nodes.map((node) =>
			node.data.drop === 'none' ? node : { ...node, data: { ...node.data, drop: 'none' } }
		);
	}

	// --- projection ----------------------------------------------------------

	/**
	 * Rebuilds the canvas from the codes.
	 *
	 * Called explicitly after every edit rather than from an effect: an effect
	 * would also have to read the arrays Svelte Flow writes back into, and would
	 * then re-run on selection and drag -- overwriting, mid-drag, the very
	 * positions it had just read.
	 */
	sync() {
		const positions = this.#positions();
		// Depths are read off the parent as the list is walked, which works because
		// the codes stay in outline order: a parent is always behind its children.
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- scratch space for one pass, never read reactively
		const depths = new Map<CodeId, number>();

		this.nodes = this.#codes.map((code) => {
			const depth = code.parentId === null ? 0 : (depths.get(code.parentId) ?? 0) + 1;
			depths.set(code.id, depth);
			return {
				id: code.id,
				type: 'code' as const,
				position: positions.get(code.id) ?? { x: 0, y: 0 },
				// In `auto` the layout owns the arrangement, so a node that could
				// be dragged anywhere would just snap back. Dragging is still how
				// re-parenting is expressed, so it stays on -- the drop handler
				// decides what it meant.
				draggable: true,
				selected: code.id === this.selectedId,
				data: {
					code,
					childCount: childrenOf(this.#codes, code.id).length,
					depth,
					direction: this.direction,
					drop: 'none' as const
				}
			};
		});

		this.edges = this.#codes
			.filter((code) => code.parentId !== null)
			.map((code) => ({
				id: `${code.parentId}->${code.id}`,
				source: code.parentId as string,
				target: code.id,
				type: 'smoothstep',
				// Branch-coloured, and muted: the edges carry no information the
				// nodes do not, so they should read as structure, not as content.
				style: `stroke: ${code.color}; stroke-width: 1.5px; opacity: 0.45;`,
				selectable: false,
				deletable: false
			}));
	}
}
