import { childrenOf, scoreRangeLabel, type Code, type CodeId } from '$lib/coding/codingTree';

/**
 * The codebook as TanStack wants it: nested, where the document is flat.
 *
 * `getSubRows` is how the table learns the tree, and it reads children off the
 * row rather than asking anything -- so the nesting has to exist as data even
 * though the codebook does not store it. Rebuilt on every edit, which is
 * cheap at codebook scale and is the only way the table cannot drift from the
 * list it is a reading of.
 */
export type CodeRow = { code: Code; children: CodeRow[] };

export function toCodeRows(codes: readonly Code[], parentId: CodeId | null = null): CodeRow[] {
	return childrenOf(codes, parentId).map((code) => ({
		code,
		children: toCodeRows(codes, code.id)
	}));
}

/**
 * Every row's height, in pixels, and not negotiable.
 *
 * Sticky ancestors are offset by `depth * ROW_HEIGHT`, so a row that grew --
 * a wrapped name, a taller badge -- would put every header below it out by the
 * difference. Names truncate for this reason rather than for want of room.
 */
export const ROW_HEIGHT = 27;

/**
 * Structural views of the TanStack row API, declared here so the components
 * stay free of the feature generics that gate the real `Row` type. The same
 * approach `DataTable` takes, for the same reason.
 */
export interface CodeRowLike {
	id: string;
	original: CodeRow;
	depth: number;
	subRows: CodeRowLike[];
}

/**
 * What the kind column says. The same marks the canvas node uses, so a code
 * reads the same in both views -- only a score writes anything out, because
 * its scale is the code's own content rather than a label for its sort.
 */
export function kindMark(code: Code): { icon: string; label: string; title: string } {
	if (code.kind === 'score') {
		const range = scoreRangeLabel(code);
		return { icon: 'fa-sliders', label: range, title: `Score, ${range}` };
	}
	if (code.kind === 'group') {
		return { icon: 'fa-layer-group', label: '', title: 'Group — organises, never applied' };
	}
	return { icon: 'fa-tag', label: '', title: 'Tag' };
}
