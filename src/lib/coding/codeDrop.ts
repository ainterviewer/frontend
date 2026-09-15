import { canMove, childrenOf, type Code, type CodeId } from './codingTree';

/**
 * Where a row being dragged would land relative to the row under the pointer.
 *
 * Three answers rather than two, because a tree has a question a list does not:
 * the gap between two rows is not the only place a row can go. `inside` is what
 * makes re-parenting expressible with the same gesture as reordering -- without
 * it the reader would need a second way to say "under this one", and the table
 * would be a flat list that happens to be indented.
 */
export type DropPosition = 'before' | 'after' | 'inside';

/** A seat in the tree: whose child, and which one. */
export type DropSpot = { parentId: CodeId | null; index: number };

/**
 * The fraction of a row's height given to its edges, top and bottom.
 *
 * The middle is the larger share on purpose. Nesting is the move a codebook is
 * mostly reorganised by, and reordering siblings is the one where a miss is
 * cheap -- a code that lands one seat off is still in the right branch.
 */
const EDGE = 0.28;

/**
 * Which of the three a pointer at `fraction` down a row means.
 *
 * `nestable` is false for a row nothing may be hung under -- the pointer is
 * still somewhere in it, and the honest reading of the middle of such a row is
 * the nearer gap rather than a nest that will be refused on release.
 */
export function dropPosition(fraction: number, nestable = true): DropPosition {
	if (fraction < EDGE) return 'before';
	if (!nestable) return 'after';
	if (fraction > 1 - EDGE) return 'after';
	return 'inside';
}

/**
 * Turns "here, like this" into the seat to move a code to, or `null` when the
 * move would not be allowed.
 *
 * The index counts the destination's children *with the dragged branch already
 * out of the list*, which is what `moveCode` expects and what makes a drag
 * downwards within one parent land where the reader aimed: the row it was
 * dropped after has moved up a seat by then, and an index read off the list as
 * drawn would overshoot by one.
 */
export function resolveDrop(
	codes: readonly Code[],
	draggedId: CodeId,
	targetId: CodeId,
	position: DropPosition
): DropSpot | null {
	const target = codes.find((code) => code.id === targetId);
	if (!target || target.id === draggedId) return null;

	const parentId = position === 'inside' ? target.id : target.parentId;
	if (!canMove(codes, draggedId, parentId)) return null;

	// Siblings as they will be once the branch is lifted out -- which is also
	// why a drop onto the dragged code's own current neighbours still resolves
	// to a sensible seat rather than to the gap it is leaving.
	const siblings = childrenOf(codes, parentId).filter((code) => code.id !== draggedId);

	if (position === 'inside') return { parentId, index: siblings.length };

	const at = siblings.findIndex((code) => code.id === targetId);
	// The target is gone from `siblings` only when it *is* the dragged code,
	// which is refused above; anything else means a tree that disagrees with
	// itself, and appending is the reading that loses least.
	if (at === -1) return { parentId, index: siblings.length };
	return { parentId, index: position === 'before' ? at : at + 1 };
}
