import { describe, expect, it } from 'vitest';
import {
	DEFAULT_PALETTE,
	addCode,
	addPaletteColor,
	ancestorsOf,
	canReparent,
	childDraftKind,
	childrenOf,
	countCodesUsing,
	createCode,
	depthOf,
	descendantIds,
	displayName,
	nextRootColor,
	normalizeHex,
	outlineOf,
	recolorSubtree,
	removePaletteColor,
	removeSubtree,
	repaintCodes,
	reparent,
	setPaletteColor,
	scoreRangeLabel,
	setKind,
	setScoreBound,
	subtreeOf,
	updateCode,
	DEFAULT_SCORE_MAX,
	DEFAULT_SCORE_MIN,
	isApplicable,
	type Code
} from './codingTree';

/** Reading a code back after an edit; failing loudly beats a silent undefined. */
function findOrThrow(codes: readonly Code[], id: string): Code {
	const code = codes.find((candidate) => candidate.id === id);
	if (!code) throw new Error(`no code ${id}`);
	return code;
}

/** A small codebook: two branches, one of them two levels deep. */
function fixture() {
	const trust = createCode({ name: 'Trust', color: '#0f766e' });
	const institutional = createCode({ parentId: trust.id, name: 'Institutional' });
	const doctors = createCode({ parentId: institutional.id, name: 'Doctors' });
	const interpersonal = createCode({ parentId: trust.id, name: 'Interpersonal' });
	const barriers = createCode({ name: 'Barriers', color: '#b45309' });
	const cost = createCode({ parentId: barriers.id, name: 'Cost' });
	const codes = [trust, institutional, doctors, interpersonal, barriers, cost];
	return { codes, trust, institutional, doctors, interpersonal, barriers, cost };
}

const names = (codes: readonly Code[]) => codes.map((code) => code.name);

describe('reading the tree', () => {
	it('groups children by parent, in array order', () => {
		const { codes, trust } = fixture();
		expect(names(childrenOf(codes, trust.id))).toEqual(['Institutional', 'Interpersonal']);
	});

	it('walks ancestors from the parent upwards', () => {
		const { codes, doctors } = fixture();
		expect(names(ancestorsOf(codes, doctors.id))).toEqual(['Institutional', 'Trust']);
		expect(depthOf(codes, doctors.id)).toBe(2);
	});

	it('collects a subtree depth first, including its root', () => {
		const { codes, trust } = fixture();
		expect(names(subtreeOf(codes, trust.id))).toEqual([
			'Trust',
			'Institutional',
			'Doctors',
			'Interpersonal'
		]);
	});

	it('reads the whole codebook as an indented outline', () => {
		const { codes } = fixture();
		expect(outlineOf(codes).map(({ code, depth }) => `${'  '.repeat(depth)}${code.name}`)).toEqual([
			'Trust',
			'  Institutional',
			'    Doctors',
			'  Interpersonal',
			'Barriers',
			'  Cost'
		]);
	});
});

describe('adding', () => {
	it('inserts a child after its parent’s last descendant, keeping outline order', () => {
		const { codes, trust } = fixture();
		const added = addCode(codes, createCode({ parentId: trust.id, name: 'Earned' }));
		expect(names(added)).toEqual([
			'Trust',
			'Institutional',
			'Doctors',
			'Interpersonal',
			'Earned',
			'Barriers',
			'Cost'
		]);
	});

	it('appends a top-level code at the end', () => {
		const { codes } = fixture();
		const added = addCode(codes, createCode({ name: 'Access' }));
		expect(names(added).at(-1)).toBe('Access');
	});
});

describe('removing', () => {
	it('takes the whole branch with it', () => {
		const { codes, institutional } = fixture();
		expect(names(removeSubtree(codes, institutional.id))).toEqual([
			'Trust',
			'Interpersonal',
			'Barriers',
			'Cost'
		]);
	});

	it('leaves the rest of the codebook alone', () => {
		const { codes, cost } = fixture();
		expect(removeSubtree(codes, cost.id)).toHaveLength(codes.length - 1);
	});
});

describe('re-parenting', () => {
	it('refuses to drop a code into its own subtree', () => {
		const { codes, trust, doctors } = fixture();
		expect(canReparent(codes, trust.id, doctors.id)).toBe(false);
		expect(reparent(codes, trust.id, doctors.id)).toEqual(codes);
	});

	it('refuses a code onto itself, or onto the parent it already has', () => {
		const { codes, cost, barriers } = fixture();
		expect(canReparent(codes, cost.id, cost.id)).toBe(false);
		expect(canReparent(codes, cost.id, barriers.id)).toBe(false);
	});

	it('moves the subtree along with the code', () => {
		const { codes, institutional, barriers, doctors } = fixture();
		const moved = reparent(codes, institutional.id, barriers.id);
		expect(moved.find((code) => code.id === institutional.id)?.parentId).toBe(barriers.id);
		expect(moved.find((code) => code.id === doctors.id)?.parentId).toBe(institutional.id);
		expect(names(subtreeOf(moved, barriers.id))).toEqual([
			'Barriers',
			'Cost',
			'Institutional',
			'Doctors'
		]);
	});

	it('promotes a code to the top level', () => {
		const { codes, cost } = fixture();
		const moved = reparent(codes, cost.id, null);
		expect(moved.find((code) => code.id === cost.id)?.parentId).toBeNull();
		expect(names(childrenOf(moved, null))).toEqual(['Trust', 'Barriers', 'Cost']);
	});

	it('keeps the array in outline order after a move', () => {
		const { codes, doctors, barriers } = fixture();
		const moved = reparent(codes, doctors.id, barriers.id);
		expect(names(moved)).toEqual([
			'Trust',
			'Institutional',
			'Interpersonal',
			'Barriers',
			'Cost',
			'Doctors'
		]);
	});

	it('does not lose codes', () => {
		const { codes, interpersonal, barriers } = fixture();
		expect(reparent(codes, interpersonal.id, barriers.id)).toHaveLength(codes.length);
	});
});

describe('editing', () => {
	it('patches one code and leaves the others identical', () => {
		const { codes, cost } = fixture();
		const edited = updateCode(codes, cost.id, { definition: 'Money as a reason not to go.' });
		expect(edited.find((code) => code.id === cost.id)?.definition).toBe(
			'Money as a reason not to go.'
		);
		expect(edited[0]).toBe(codes[0]);
	});
});

describe('colours', () => {
	it('picks the least-used palette hue for a new top-level code', () => {
		const { codes } = fixture();
		const picked = nextRootColor(codes, DEFAULT_PALETTE);
		expect(picked).not.toBe('#0f766e');
		expect(picked).not.toBe('#b45309');
	});

	it('reuses a hue freed by a deleted branch', () => {
		const { codes, barriers } = fixture();
		expect(nextRootColor(removeSubtree(codes, barriers.id), DEFAULT_PALETTE)).toBe('#b45309');
	});
});

describe('recolorSubtree', () => {
	it('paints the code and everything under it', () => {
		const { codes, trust, doctors, barriers } = fixture();
		const painted = recolorSubtree(codes, trust.id, '#123456');
		expect(painted.find((code) => code.id === doctors.id)?.color).toBe('#123456');
		expect(painted.find((code) => code.id === barriers.id)?.color).toBe('#b45309');
	});

	it('paints a leaf as just that leaf', () => {
		const { codes, cost } = fixture();
		const painted = recolorSubtree(codes, cost.id, '#123456');
		expect(painted.filter((code) => code.color === '#123456')).toHaveLength(1);
	});
});

describe('display', () => {
	it('never draws an empty label', () => {
		expect(displayName('   ')).toBe('Untitled code');
		expect(displayName('  Trust ')).toBe('Trust');
	});
});

describe('descendants', () => {
	it('excludes the code itself', () => {
		const { codes, trust, doctors } = fixture();
		const ids = descendantIds(codes, trust.id);
		expect(ids.has(trust.id)).toBe(false);
		expect(ids.has(doctors.id)).toBe(true);
	});
});

describe('kind', () => {
	it('starts a code as a tag', () => {
		const code = createCode({ name: 'Trust' });
		expect(code.kind).toBe('tag');
		expect(code.minValue).toBeNull();
	});

	it('gives a code that becomes a score the default scale', () => {
		const { codes, doctors } = fixture();
		const scored = findOrThrow(setKind(codes, doctors.id, 'score'), doctors.id);
		expect(scored.minValue).toBe(DEFAULT_SCORE_MIN);
		expect(scored.maxValue).toBe(DEFAULT_SCORE_MAX);
		expect(scoreRangeLabel(scored)).toBe(`${DEFAULT_SCORE_MIN}–${DEFAULT_SCORE_MAX}`);
	});

	it('clears the scale when a score stops being one', () => {
		const { codes, doctors } = fixture();
		const scored = setScoreBound(setKind(codes, doctors.id, 'score'), doctors.id, 'max', 10);
		const tagged = findOrThrow(setKind(scored, doctors.id, 'tag'), doctors.id);
		expect(tagged.minValue).toBeNull();
		expect(tagged.maxValue).toBeNull();
	});

	it('changes only the code asked for, unlike colour', () => {
		const { codes, trust, doctors } = fixture();
		const next = setKind(codes, trust.id, 'group');
		expect(findOrThrow(next, trust.id).kind).toBe('group');
		expect(findOrThrow(next, doctors.id).kind).toBe('tag');
	});

	it('does not apply a group to anything', () => {
		const { codes, trust } = fixture();
		expect(isApplicable(findOrThrow(setKind(codes, trust.id, 'group'), trust.id))).toBe(false);
		expect(isApplicable(findOrThrow(codes, trust.id))).toBe(true);
	});

	it('leaves the ends alone when they cross', () => {
		const { codes, doctors } = fixture();
		const scored = setScoreBound(setKind(codes, doctors.id, 'score'), doctors.id, 'min', 9);
		expect(findOrThrow(scored, doctors.id).minValue).toBe(9);
		expect(findOrThrow(scored, doctors.id).maxValue).toBe(DEFAULT_SCORE_MAX);
	});

	it('refuses a scale on a code that is not a score', () => {
		const { codes, doctors } = fixture();
		expect(findOrThrow(setScoreBound(codes, doctors.id, 'min', 3), doctors.id).minValue).toBeNull();
	});
});

describe('new sub-codes', () => {
	it('inherits a score scale from the parent', () => {
		const { codes, trust } = fixture();
		const parent = findOrThrow(
			setScoreBound(setKind(codes, trust.id, 'score'), trust.id, 'max', 7),
			trust.id
		);
		expect(childDraftKind(parent)).toEqual({ kind: 'score', minValue: 1, maxValue: 7 });
	});

	it('starts a child of a group as a tag, so it can be used', () => {
		const { codes, trust } = fixture();
		const parent = findOrThrow(setKind(codes, trust.id, 'group'), trust.id);
		expect(childDraftKind(parent)).toEqual({ kind: 'tag' });
	});

	it('starts a top-level code as a tag', () => {
		expect(childDraftKind(undefined)).toEqual({ kind: 'tag' });
	});
});

describe('palette', () => {
	it('reads a hex however it is written, and refuses what is not one', () => {
		expect(normalizeHex('#0F766E')).toBe('#0f766e');
		expect(normalizeHex('0f766e')).toBe('#0f766e');
		expect(normalizeHex('#abc')).toBe('#aabbcc');
		expect(normalizeHex('teal')).toBeNull();
		expect(normalizeHex('#0f766')).toBeNull();
	});

	it('adds a colour once, and leaves the palette identical otherwise', () => {
		const palette = ['#0f766e'];
		expect(addPaletteColor(palette, '#B45309')).toEqual(['#0f766e', '#b45309']);
		// A duplicate and a non-colour both return the same array, so the caller's
		// commit is a no-op rather than an undo step that changed nothing.
		expect(addPaletteColor(palette, '#0F766E')).toBe(palette);
		expect(addPaletteColor(palette, 'nonsense')).toBe(palette);
	});

	it('allows an edit to pass through a hue already in the palette', () => {
		// A native picker sends a value per movement; refusing the ones that
		// collide would stick the swatch under the reader's cursor.
		const palette = ['#0f766e', '#b45309'];
		expect(setPaletteColor(palette, 1, '#0f766e')).toEqual(['#0f766e', '#0f766e']);
		expect(setPaletteColor(palette, 5, '#000000')).toBe(palette);
	});

	it('never empties the palette', () => {
		expect(removePaletteColor(['#0f766e'], 0)).toEqual(['#0f766e']);
		expect(removePaletteColor(['#0f766e', '#b45309'], 0)).toEqual(['#b45309']);
	});

	it('repaints every code wearing a colour, and counts them', () => {
		const { codes, barriers } = fixture();
		const before = countCodesUsing(codes, barriers.color);
		expect(before).toBeGreaterThan(0);
		const repainted = repaintCodes(codes, barriers.color, '#123456');
		expect(countCodesUsing(repainted, '#123456')).toBe(before);
		expect(countCodesUsing(repainted, barriers.color)).toBe(0);
	});
});
