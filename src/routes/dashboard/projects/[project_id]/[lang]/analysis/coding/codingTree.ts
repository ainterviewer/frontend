/**
 * The codebook, and the operations that keep it a tree.
 *
 * Codes are held flat and point at their parent, rather than nesting children
 * inside each other. A codebook is edited by moving branches around, and every
 * such move on a nested structure is a splice of two lists at two depths; on a
 * flat list it is one field. The tree is a *reading* of the list, recovered by
 * the helpers below, which is also what the canvas wants -- Svelte Flow draws
 * nodes and edges, not nesting.
 *
 * Array order is sibling order. Nothing else reads it, so a code carries no
 * rank field that could disagree with where it actually sits.
 *
 * Everything here is pure and free of runes: this is the part worth unit
 * testing, and the part the backend will eventually have to agree with.
 */

export type CodeId = string;

export type XY = { x: number; y: number };

export type Code = {
	id: CodeId;
	/** `null` for a top-level code. */
	parentId: CodeId | null;
	name: string;
	/** What counts as this code -- the rule a second coder would apply. */
	definition: string;
	/** The analyst's own thinking: why it exists, what it borders on. */
	memo: string;
	/** Hex. Inherited from the parent at creation, so a branch reads as one. */
	color: string;
	/**
	 * Where the reader dragged it. Only read in the `free` layout -- under
	 * `auto` the position is recomputed and this is what it falls back to when
	 * the reader breaks out again, so it survives a round trip through `auto`.
	 */
	position: XY | null;
	/** What applying this code to a passage would mean. See `CodeKind`. */
	kind: CodeKind;
	/**
	 * The ends of the scale, inclusive. Both `null` unless `kind` is `score`;
	 * `setKind` is what keeps that true, so nothing downstream has to ask
	 * whether a range on a tag means anything.
	 */
	minValue: number | null;
	maxValue: number | null;
};

/**
 * What a code *is*, which decides what applying it to a passage produces.
 *
 * `tag` is the ordinary case: the code either applies or it does not. `score`
 * asks the coder for a number in a fixed range, for the codes that are really
 * degrees of something rather than presences of it. `group` is neither -- the
 * code organises the branch under it and carries the thinking about it, but is
 * never applied to anything itself.
 *
 * `group` exists because without it every container in a codebook has to
 * pretend to be a tag, and the resulting counts are nonsense: a passage coded
 * under a child is not coded under the family the child belongs to. Saying so
 * on the code is cheaper than teaching every later report to guess it from
 * whether a code has children -- a leaf can be a group too, when it is a
 * heading waiting to be filled in.
 */
export type CodeKind = 'group' | 'tag' | 'score';

export const CODE_KINDS: readonly CodeKind[] = ['group', 'tag', 'score'];

/** The range a score starts on, when nobody has said otherwise. */
export const DEFAULT_SCORE_MIN = 1;
export const DEFAULT_SCORE_MAX = 5;

/** Whether this code is one a coder can actually put on a passage. */
export function isApplicable(code: Code): boolean {
	return code.kind !== 'group';
}

/** The scale as it is written on the node and in the inspector, e.g. `1–5`. */
export function scoreRangeLabel(code: Code): string {
	if (code.kind !== 'score') return '';
	const min = code.minValue ?? DEFAULT_SCORE_MIN;
	const max = code.maxValue ?? DEFAULT_SCORE_MAX;
	return `${min}–${max}`;
}

/**
 * Hues for top-level codes, checked pairwise for colour-vision deficiency.
 *
 * Deliberately not `LANGUAGE_COLORS`: a colour here says "same branch of the
 * codebook", and on a dashboard where green already means a language, reusing
 * that scale would make two unrelated things look like one.
 */
export const CODE_COLORS = [
	'#0f766e',
	'#b45309',
	'#4338ca',
	'#be185d',
	'#0369a1',
	'#4d7c0f',
	'#7c3aed',
	'#a16207'
];

/** The colour a code falls back to when its own is missing or unreadable. */
export const DEFAULT_CODE_COLOR = CODE_COLORS[0];

const ID_PREFIX = 'code';

let idCounter = 0;

/**
 * Ids are generated here rather than by the backend because a code has to be
 * selectable and drawable the instant it is created; waiting for a round trip
 * would mean a node with no identity on screen. Server-assigned ids can replace
 * these on save without anything here caring, since nothing derives meaning
 * from the shape of an id.
 */
export function newCodeId(): CodeId {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return `${ID_PREFIX}-${crypto.randomUUID()}`;
	}
	idCounter += 1;
	return `${ID_PREFIX}-${idCounter}-${Date.now().toString(36)}`;
}

export type CodeDraft = {
	parentId?: CodeId | null;
	name?: string;
	definition?: string;
	memo?: string;
	color?: string;
	position?: XY | null;
	kind?: CodeKind;
	minValue?: number | null;
	maxValue?: number | null;
};

export function createCode(draft: CodeDraft = {}): Code {
	const kind = draft.kind ?? 'tag';
	const score = kind === 'score';
	return {
		id: newCodeId(),
		parentId: draft.parentId ?? null,
		name: draft.name ?? 'New code',
		definition: draft.definition ?? '',
		memo: draft.memo ?? '',
		color: draft.color ?? DEFAULT_CODE_COLOR,
		position: draft.position ?? null,
		kind,
		minValue: score ? (draft.minValue ?? DEFAULT_SCORE_MIN) : null,
		maxValue: score ? (draft.maxValue ?? DEFAULT_SCORE_MAX) : null
	};
}

/**
 * What a new code under `parent` should be.
 *
 * Sub-codes of a score are nearly always more of the same scale, so the kind
 * and its range are inherited the way colour is. The exception is a `group`
 * parent: a group is a heading, and inheriting it would hand the reader a new
 * code that cannot be applied to anything -- so a child of a group starts as an
 * ordinary tag, which is what a heading is usually waiting for.
 */
export function childDraftKind(
	parent: Code | undefined
): Pick<CodeDraft, 'kind' | 'minValue' | 'maxValue'> {
	if (!parent || parent.kind === 'group') return { kind: 'tag' };
	return { kind: parent.kind, minValue: parent.minValue, maxValue: parent.maxValue };
}

export function findCode(codes: readonly Code[], id: CodeId | null): Code | undefined {
	if (id === null) return undefined;
	return codes.find((code) => code.id === id);
}

export function childrenOf(codes: readonly Code[], parentId: CodeId | null): Code[] {
	return codes.filter((code) => code.parentId === parentId);
}

export function rootCodes(codes: readonly Code[]): Code[] {
	return childrenOf(codes, null);
}

/** Parent first, then its parent, up to the top-level code. */
export function ancestorsOf(codes: readonly Code[], id: CodeId): Code[] {
	const trail: Code[] = [];
	const seen = new Set<CodeId>([id]);
	let current = findCode(codes, id)?.parentId ?? null;
	while (current !== null && !seen.has(current)) {
		seen.add(current);
		const parent = findCode(codes, current);
		if (!parent) break;
		trail.push(parent);
		current = parent.parentId;
	}
	return trail;
}

export function depthOf(codes: readonly Code[], id: CodeId): number {
	return ancestorsOf(codes, id).length;
}

/** The code and everything under it, in depth-first order. */
export function subtreeOf(codes: readonly Code[], id: CodeId): Code[] {
	const root = findCode(codes, id);
	if (!root) return [];
	const collected: Code[] = [root];
	for (const child of childrenOf(codes, id)) {
		collected.push(...subtreeOf(codes, child.id));
	}
	return collected;
}

export function descendantIds(codes: readonly Code[], id: CodeId): Set<CodeId> {
	const ids = new Set<CodeId>();
	for (const code of subtreeOf(codes, id)) {
		if (code.id !== id) ids.add(code.id);
	}
	return ids;
}

/** Every code in depth-first order, each with how deep it sits. */
export function outlineOf(codes: readonly Code[]): { code: Code; depth: number }[] {
	const rows: { code: Code; depth: number }[] = [];
	const walk = (parentId: CodeId | null, depth: number) => {
		for (const code of childrenOf(codes, parentId)) {
			rows.push({ code, depth });
			walk(code.id, depth + 1);
		}
	};
	walk(null, 0);
	return rows;
}

/**
 * Whether `id` may be hung under `parentId`.
 *
 * The one move that has to be refused is dropping a code into its own subtree,
 * which would cut that whole branch loose into a cycle no view can draw. Moving
 * to where it already is is refused too, so callers can use this to decide
 * whether anything happened at all.
 */
export function canReparent(codes: readonly Code[], id: CodeId, parentId: CodeId | null): boolean {
	const code = findCode(codes, id);
	if (!code) return false;
	if (parentId === id) return false;
	if (code.parentId === parentId) return false;
	if (parentId !== null && !findCode(codes, parentId)) return false;
	if (parentId !== null && descendantIds(codes, id).has(parentId)) return false;
	return true;
}

/**
 * Inserts a code after its parent's last descendant, so the flat array stays
 * in depth-first order and reads as the outline it represents.
 *
 * Worth the splice rather than pushing to the end: `outlineOf` would recover
 * the same tree either way, but a list that drifts out of tree order makes
 * every diff against a saved codebook noise, and makes the seed file below
 * unreadable.
 */
function insertInOrder(codes: readonly Code[], code: Code): Code[] {
	const next = [...codes];
	if (code.parentId === null) {
		next.push(code);
		return next;
	}
	const parentIndex = next.findIndex((candidate) => candidate.id === code.parentId);
	if (parentIndex === -1) {
		next.push(code);
		return next;
	}
	const branch = descendantIds(codes, code.parentId);
	let insertAt = parentIndex + 1;
	while (insertAt < next.length && branch.has(next[insertAt].id)) insertAt += 1;
	next.splice(insertAt, 0, code);
	return next;
}

export function addCode(codes: readonly Code[], code: Code): Code[] {
	return insertInOrder(codes, code);
}

/** Removes a code together with everything under it. */
export function removeSubtree(codes: readonly Code[], id: CodeId): Code[] {
	const doomed = descendantIds(codes, id);
	doomed.add(id);
	return codes.filter((code) => !doomed.has(code.id));
}

export function updateCode(
	codes: readonly Code[],
	id: CodeId,
	patch: Partial<Omit<Code, 'id'>>
): Code[] {
	return codes.map((code) => (code.id === id ? { ...code, ...patch } : code));
}

/**
 * Moves a code, and its whole subtree with it, under a new parent.
 *
 * Returns the list unchanged when the move is not allowed, so a caller that
 * cannot be bothered to ask `canReparent` first still cannot corrupt the tree.
 * The subtree comes along for free: children point at the code, not at its
 * former parent, so there is nothing else to rewrite.
 */
export function reparent(codes: readonly Code[], id: CodeId, parentId: CodeId | null): Code[] {
	if (!canReparent(codes, id, parentId)) return codes as Code[];
	const moving = subtreeOf(codes, id).map((code) => code.id);
	const movingSet = new Set(moving);
	const remaining = codes.filter((code) => !movingSet.has(code.id));
	const branch = subtreeOf(codes, id).map((code) =>
		code.id === id ? { ...code, parentId } : code
	);
	// Re-inserted as a block so the moved branch lands beside its new siblings
	// rather than staying where it was in the array.
	if (parentId === null) return [...remaining, ...branch];
	const parentIndex = remaining.findIndex((code) => code.id === parentId);
	if (parentIndex === -1) return [...remaining, ...branch];
	const under = descendantIds(remaining, parentId);
	let insertAt = parentIndex + 1;
	while (insertAt < remaining.length && under.has(remaining[insertAt].id)) insertAt += 1;
	return [...remaining.slice(0, insertAt), ...branch, ...remaining.slice(insertAt)];
}

/**
 * Recolours a code and everything under it.
 *
 * Colour here means "same branch", not "this particular code", so it is always
 * applied to a whole subtree -- which is also why a code that moves between
 * branches has to be repainted rather than carrying its old hue across.
 */
export function recolorSubtree(codes: readonly Code[], id: CodeId, color: string): Code[] {
	const branch = new Set(subtreeOf(codes, id).map((code) => code.id));
	return codes.map((code) => (branch.has(code.id) ? { ...code, color } : code));
}

/**
 * Changes what a code is, and keeps its range honest while doing so.
 *
 * The range lives on the code rather than beside it, so becoming a tag has to
 * clear it -- otherwise a code that was briefly a score goes on carrying a
 * scale nothing reads, and saving it would persist a number that means nothing.
 * Becoming a score gets the default scale rather than an empty one, so a fresh
 * score code is usable without further input.
 *
 * Only this code changes. Unlike colour, the kind is not a property of the
 * branch: a group heading over tags is the ordinary shape of a codebook, and
 * pushing the kind down would make that impossible to express.
 */
export function setKind(codes: readonly Code[], id: CodeId, kind: CodeKind): Code[] {
	return codes.map((code) => {
		if (code.id !== id || code.kind === kind) return code;
		if (kind !== 'score') return { ...code, kind, minValue: null, maxValue: null };
		return {
			...code,
			kind,
			minValue: code.minValue ?? DEFAULT_SCORE_MIN,
			maxValue: code.maxValue ?? DEFAULT_SCORE_MAX
		};
	});
}

/**
 * Moves one end of a score's scale.
 *
 * A blank field arrives as `null` and is left as one while the reader is
 * clearing it to type something else; `scoreRangeLabel` falls back to the
 * defaults, so a half-typed range still draws. Nothing is reordered when the
 * ends cross -- swapping them under the cursor of someone mid-edit is worse
 * than briefly showing `5–1`.
 */
export function setScoreBound(
	codes: readonly Code[],
	id: CodeId,
	end: 'min' | 'max',
	value: number | null
): Code[] {
	return codes.map((code) => {
		if (code.id !== id || code.kind !== 'score') return code;
		return end === 'min' ? { ...code, minValue: value } : { ...code, maxValue: value };
	});
}

/**
 * The colour for a new top-level code: the palette hue currently carrying the
 * fewest branches, so a codebook grown one code at a time stays distinguishable
 * instead of cycling back onto its first hue the moment one is deleted.
 */
export function nextRootColor(codes: readonly Code[]): string {
	const used = new Map<string, number>(CODE_COLORS.map((color) => [color, 0]));
	for (const code of rootCodes(codes)) {
		const count = used.get(code.color);
		if (count !== undefined) used.set(code.color, count + 1);
	}
	let best = CODE_COLORS[0];
	let bestCount = Number.POSITIVE_INFINITY;
	for (const [color, count] of used) {
		if (count < bestCount) {
			best = color;
			bestCount = count;
		}
	}
	return best;
}

/** A name that is safe to draw: trimmed, and never empty. */
export function displayName(name: string): string {
	const trimmed = name.trim();
	return trimmed === '' ? 'Untitled code' : trimmed;
}
