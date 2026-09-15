import { describe, expect, it } from 'vitest';
import {
	addCode,
	ancestorsOf,
	canReparent,
	childrenOf,
	createCode,
	depthOf,
	descendantIds,
	displayName,
	nextRootColor,
	outlineOf,
	removeSubtree,
	reparent,
	subtreeOf,
	updateCode,
	type Code
} from './codingTree';

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
		const picked = nextRootColor(codes);
		expect(picked).not.toBe('#0f766e');
		expect(picked).not.toBe('#b45309');
	});

	it('reuses a hue freed by a deleted branch', () => {
		const { codes, barriers } = fixture();
		expect(nextRootColor(removeSubtree(codes, barriers.id))).toBe('#b45309');
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
