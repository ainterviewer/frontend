import type { Edge, Node } from '@xyflow/svelte';
import { getContext, setContext } from 'svelte';
import { generateColor } from '$lib/utils/colors';
import {
	DEFAULT_PALETTE,
	addCode,
	addPaletteColor,
	ancestorsOf,
	canMove,
	canReparent,
	childDraftKind,
	childrenOf,
	countCodesUsing,
	createCode,
	descendantIds,
	findCode,
	moveCode,
	nextRootColor,
	recolorSubtree,
	removePaletteColor,
	removeSubtree,
	reparent,
	repaintCodes,
	setKind,
	setPaletteColor,
	setScoreBound,
	subtreeOf,
	updateCode,
	type Code,
	type CodeId,
	type CodeKind,
	type XY
} from './codingTree';
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
 * Persistence is somebody else's job: every edit bumps `revision`, and
 * `$lib/coding/store.svelte` watches that and writes the codebook back. This
 * class deliberately knows nothing about the API, so the editor's behaviour
 * can be reasoned about -- and tested -- without one.
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

/**
 * What undo restores.
 *
 * The palette travels with the codes rather than beside them because editing it
 * repaints codes: dropping a colour from the palette recolours every branch
 * that wore it, and an undo that took back only half of that would leave the
 * reader a codebook painted in a hue they can no longer pick.
 */
type Snapshot = { codes: Code[]; palette: string[] };

export class CodingTreeState {
	#codes = $state.raw<Code[]>([]);
	#palette = $state.raw<string[]>([...DEFAULT_PALETTE]);
	/**
	 * Bumped by every change worth saving, and read by the saver.
	 *
	 * A counter rather than an effect on `codes`, because a hand-dragged
	 * position is a change to save and *not* an edit to the codes -- see
	 * `setPosition`, which rewrites the array without committing.
	 */
	#revision = $state(0);
	#past: Snapshot[] = [];
	#future: Snapshot[] = [];
	/** What the last commit was, so consecutive keystrokes can share an entry. */
	#lastEdit: string | null = null;

	layoutMode = $state<LayoutMode>('auto');
	/**
	 * Left-to-right by default: a codebook grows mostly by nesting, so it runs
	 * deeper than it is wide, and the nodes are wide boxes. Laid out top-down
	 * that shape fights the pane -- siblings spread far apart horizontally while
	 * the depth is squeezed -- where across the page each level is one step
	 * right and the pane scrolls the way the tree grows.
	 */
	direction = $state<LayoutDirection>('LR');

	#selectedId = $state<CodeId | null>(null);
	#nameFocusFor = $state<CodeId | null>(null);

	get selectedId(): CodeId | null {
		return this.#selectedId;
	}

	/**
	 * Selecting rebuilds the canvas, and drops any pending rename.
	 *
	 * Behind a setter because both of those have to happen at every call site
	 * and neither is obvious from `selectedId = x`.
	 *
	 * Repainting the ring is what makes the selection visible. Which node is
	 * ringed is part of the projection, so a selection that does not touch it is
	 * only half made: the inspector opens on the new code while the canvas goes
	 * on ringing the old one. It went unnoticed because the one path that did
	 * work -- clicking a node -- is the one where Svelte Flow sets its own
	 * selection first and our projection merely agrees with it afterwards.
	 *
	 * A rename request names the code it is for, but the inspector is unmounted
	 * whenever nothing is selected, so an unconsumed request outlives the panel
	 * that was meant to answer it -- and would then be answered by the next
	 * panel to appear, turning an ordinary click into an edit.
	 */
	set selectedId(id: CodeId | null) {
		if (id === this.#selectedId) return;
		this.#selectedId = id;
		this.#nameFocusFor = null;
		this.#applySelection();
	}

	/**
	 * Moves the ring, and touches nothing else.
	 *
	 * Deliberately not a full `sync()`. Selection changes in the middle of a
	 * click that Svelte Flow is still handling, and handing it a wholly rebuilt
	 * set of nodes at that moment -- positions recomputed, every node a new
	 * object -- loses the gesture: the element under the pointer is replaced
	 * before the second half of a double click lands on it. So this patches the
	 * one field that changed, as `markDropTarget` does mid-drag, and leaves
	 * every node that was already right untouched.
	 */
	#applySelection() {
		this.nodes = this.nodes.map((node) => {
			const selected = node.id === this.#selectedId;
			return node.selected === selected ? node : { ...node, selected };
		});
	}

	nodes = $state.raw<CodeNode[]>([]);
	edges = $state.raw<Edge[]>([]);

	/**
	 * Bumped when the canvas should refit its viewport.
	 *
	 * Two things ask for it: the arrangement being rewritten wholesale -- turning
	 * the tree on its side, or handing it back to the layout -- and a code being
	 * added that the reader now has to be able to see.
	 *
	 * A counter rather than the canvas watching `direction`, `layoutMode` and the
	 * codes directly, because most changes to those should *not* move the
	 * viewport: breaking out to `free` leaves every node where it was, and an
	 * edit must never yank the canvas away from what is being worked on. Asking
	 * explicitly keeps that decision here, at each call site, instead of in a
	 * rule the canvas has to infer.
	 */
	refits = $state(0);

	/**
	 * The code whose name the inspector should put the caret in, or `null`.
	 *
	 * Asked for at the moments renaming is what the reader is about to do: a
	 * code that has just been created and is still called `New code`, and a
	 * double click on a node. Deliberately *not* on selection -- a single click
	 * is how the reader opens a code to read it, and stealing the caret then
	 * means every later keystroke has to be aimed back at the field it was taken
	 * from.
	 *
	 * An id that is consumed, rather than a counter that is bumped. A counter
	 * says only that *someone* asked at some point, which an inspector mounting
	 * fresh cannot tell from a request meant for it -- so reselecting a code
	 * after a rename re-ran the old request.
	 */
	get nameFocusFor(): CodeId | null {
		return this.#nameFocusFor;
	}

	/** The node under the pointer mid-drag, and whether dropping there is legal. */
	#dragging: CodeId | null = null;

	constructor() {
		this.sync();
	}

	get codes(): readonly Code[] {
		return this.#codes;
	}

	/** How many times this codebook has changed. See `#revision`. */
	get revision(): number {
		return this.#revision;
	}

	/**
	 * Replaces the whole document with a stored one, unundoably.
	 *
	 * The history is dropped rather than kept: an undo across a load would
	 * offer the reader the codebook they had *before* this one arrived and,
	 * once saved, would overwrite the one that is stored. `revision` is
	 * deliberately not bumped either -- this is the state arriving, not
	 * changing, and a bump would have the saver write back what it just read.
	 */
	load(codes: Code[], palette: string[]) {
		this.#past = [];
		this.#future = [];
		this.#lastEdit = null;
		this.#codes = codes;
		if (palette.length > 0) this.#palette = palette;
		this.#selectedId = null;
		this.#nameFocusFor = null;
		this.refits += 1;
		this.sync();
	}

	/** The colours this codebook offers for a branch, in the order they are shown. */
	get palette(): readonly string[] {
		return this.#palette;
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
		this.#commitAll({ codes: next, palette: this.#palette }, edit);
	}

	/** As `#commit`, for the edits that change the palette and the codes at once. */
	#commitAll(next: Snapshot, edit: string | null = null) {
		if (next.codes === this.#codes && next.palette === this.#palette) return;
		if (edit === null || edit !== this.#lastEdit) {
			this.#past.push({ codes: this.#codes, palette: this.#palette });
			if (this.#past.length > HISTORY_LIMIT) this.#past.shift();
		}
		this.#lastEdit = edit;
		this.#future = [];
		this.#codes = next.codes;
		this.#palette = next.palette;
		this.#revision += 1;
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
			color: parent ? parent.color : nextRootColor(this.#codes, this.#palette),
			position: at ?? placeNewCode(this.#codes, parentId, this.#positions()),
			...childDraftKind(parent)
		});
		this.#commit(addCode(this.#codes, code));
		// Selection first: it is what clears any rename left over from the code
		// that was open before.
		this.selectedId = code.id;
		// A code arrives called `New code`, so the name is the one field the
		// reader always has to touch next.
		this.#nameFocusFor = code.id;
		return code.id;
	}

	/**
	 * A new top-level code, from the toolbar.
	 *
	 * Distinct from `addChild(null)` only in asking for a refit. A new branch is
	 * laid out beside the existing ones and widens the whole tree, so it lands
	 * off screen as often as not -- which is no use when the next thing the
	 * reader does is type its name. Adding a sub-code does not refit: it appears
	 * beside a parent the reader is already looking at.
	 */
	addRootCode(): CodeId {
		const id = this.addChild(null);
		this.refits += 1;
		return id;
	}

	/** Puts the caret in the name field of whatever is selected. */
	focusName() {
		this.#nameFocusFor = this.#selectedId;
	}

	/** Called by the inspector once it has answered the request. */
	consumeNameFocus() {
		this.#nameFocusFor = null;
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
	 * Changes what the code is: a tag, a score, or a group that only organises.
	 *
	 * One commit, so the range that comes or goes with the kind is taken back by
	 * a single undo rather than leaving the reader a tag carrying a stale scale.
	 */
	setKind(id: CodeId, kind: CodeKind) {
		this.#commit(setKind(this.#codes, id, kind));
	}

	/**
	 * Moves one end of a score's scale. Coalesced per end, so typing `10` over a
	 * `5` is one undo and not two.
	 */
	setScoreBound(id: CodeId, end: 'min' | 'max', value: number | null) {
		this.#commit(setScoreBound(this.#codes, id, end, value), `${end}:${id}`);
	}

	/**
	 * Recolours a code and everything under it, so a branch keeps reading as one
	 * thing. Recolouring a leaf is just the leaf.
	 */
	recolorBranch(id: CodeId, color: string) {
		this.#commit(recolorSubtree(this.#codes, id, color));
	}

	// --- palette -------------------------------------------------------------

	/**
	 * Adds a colour to the palette without applying it to anything.
	 *
	 * Without an argument it suggests one as far as possible from those already
	 * there, which is the case that matters: the reader who has run out of
	 * distinguishable hues wants another distinguishable hue, not a second
	 * decision about which.
	 */
	addColor(color?: string): string | null {
		const next = addPaletteColor(this.#palette, color ?? generateColor([...this.#palette]));
		if (next === this.#palette) return null;
		this.#commitAll({ codes: this.#codes, palette: next });
		return next[next.length - 1];
	}

	/**
	 * Moves a palette entry, taking every branch painted from it along.
	 *
	 * Coalesced per entry, so dragging a native colour picker across the wheel is
	 * one undo and not one per hue it passed through.
	 */
	setColor(index: number, color: string) {
		const palette = setPaletteColor(this.#palette, index, color);
		if (palette === this.#palette) return;
		const codes = repaintCodes(this.#codes, this.#palette[index], palette[index]);
		this.#commitAll({ codes, palette }, `palette:${index}`);
	}

	/**
	 * Drops a palette entry, and repaints onto the first remaining colour any
	 * branch that was wearing it.
	 *
	 * Deliberately not refused when the colour is in use. A palette entry is a
	 * choice the analyst made about their own codebook, and the alternative --
	 * "recolour these four branches before you may tidy this up" -- is busywork
	 * for something one undo takes back. `colorUsage` lets the button say how
	 * many branches will move before it is pressed.
	 */
	removeColor(index: number) {
		const palette = removePaletteColor(this.#palette, index);
		if (palette === this.#palette) return;
		const codes = repaintCodes(this.#codes, this.#palette[index], palette[0]);
		this.#commitAll({ codes, palette });
	}

	/** How many codes wear a colour -- what a delete would repaint. */
	colorUsage(color: string): number {
		return countCodesUsing(this.#codes, color);
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
		const color = parent ? parent.color : nextRootColor(removeSubtree(moved, id), this.#palette);
		this.#commit(recolorSubtree(moved, id, color));
		return true;
	}

	canMoveTo(id: CodeId, parentId: CodeId | null): boolean {
		return canMove(this.#codes, id, parentId);
	}

	/**
	 * Moves a code to a seat among a parent's children -- what a dragged table
	 * row means, where the canvas can only say whose child something is.
	 *
	 * Repaints only when the branch actually changed. `moveUnder` can repaint
	 * unconditionally because it refuses a move that stays put; here staying
	 * under the same parent is the common case, and recolouring on every nudge
	 * up or down would overwrite a hand-set hue for a reorder that says nothing
	 * about kinship.
	 */
	moveTo(id: CodeId, parentId: CodeId | null, index: number): boolean {
		const before = findCode(this.#codes, id);
		if (!before) return false;
		const moved = moveCode(this.#codes, id, parentId, index);
		if (moved === this.#codes) return false;
		if (before.parentId === parentId) {
			this.#commit(moved);
			return true;
		}
		const parent = findCode(moved, parentId);
		const color = parent ? parent.color : nextRootColor(removeSubtree(moved, id), this.#palette);
		this.#commit(recolorSubtree(moved, id, color));
		return true;
	}

	undo() {
		this.#lastEdit = null;
		const previous = this.#past.pop();
		if (!previous) return;
		this.#future.push({ codes: this.#codes, palette: this.#palette });
		this.#codes = previous.codes;
		this.#palette = previous.palette;
		this.#revision += 1;
		if (this.selectedId && !findCode(previous.codes, this.selectedId)) this.selectedId = null;
		this.sync();
	}

	redo() {
		this.#lastEdit = null;
		const next = this.#future.pop();
		if (!next) return;
		this.#past.push({ codes: this.#codes, palette: this.#palette });
		this.#codes = next.codes;
		this.#palette = next.palette;
		this.#revision += 1;
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
			this.#revision += 1;
		}
		this.layoutMode = mode;
		this.sync();
	}

	setDirection(direction: LayoutDirection) {
		if (direction === this.direction) return;
		this.direction = direction;
		this.refits += 1;
		this.sync();
	}

	/** Forgets every hand-placed position and lets the layout take over again. */
	resetPositions() {
		this.#codes = this.#codes.map((code) => ({ ...code, position: null }));
		this.layoutMode = 'auto';
		this.#revision += 1;
		this.refits += 1;
		this.sync();
	}

	/** A drag in `free` mode. Not undoable -- see `#commit` -- but saved. */
	setPosition(id: CodeId, position: XY) {
		if (this.layoutMode !== 'free') return;
		this.#codes = this.#codes.map((code) => (code.id === id ? { ...code, position } : code));
		this.#revision += 1;
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

/**
 * Renaming, handed to the node components.
 *
 * A node is drawn by Svelte Flow from a `nodeTypes` map, so it is never given
 * props by the code that owns the tree and cannot be passed the state directly.
 * Context carries the one thing it needs -- rather than the whole state, which
 * would let a node reach parts of the editor it has no business touching.
 */
const RENAME_KEY = Symbol('coding-tree-rename');

export function provideRename(rename: () => void) {
	setContext(RENAME_KEY, rename);
}

export function useRename(): () => void {
	return getContext<(() => void) | undefined>(RENAME_KEY) ?? (() => {});
}
