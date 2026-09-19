import { describe, expect, it } from 'vitest';

import { dropPosition, resolveDrop } from './codeDrop';
import { childrenOf, type Code, createCode, moveCode, outlineOf } from './codingTree';

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
const siblingNames = (codes: readonly Code[], parentId: string | null) =>
	names(childrenOf(codes, parentId));

describe('reading a pointer as a drop', () => {
	it('splits a row into a gap above, a nest, and a gap below', () => {
		expect(dropPosition(0.05)).toBe('before');
		expect(dropPosition(0.5)).toBe('inside');
		expect(dropPosition(0.95)).toBe('after');
	});

	it('gives a row nothing may go under no middle', () => {
		expect(dropPosition(0.5, false)).toBe('after');
		// The gap above is still the gap above: refusing the nest must not also
		// take away the one reading that was never in question.
		expect(dropPosition(0.05, false)).toBe('before');
	});
});

describe('resolving a drop to a seat', () => {
	it('nests onto the end of the target’s children', () => {
		const { codes, cost, trust } = fixture();
		expect(resolveDrop(codes, cost.id, trust.id, 'inside')).toEqual({
			parentId: trust.id,
			index: 2
		});
	});

	it('reads a gap as a seat among the target’s siblings', () => {
		const { codes, cost, interpersonal, trust } = fixture();
		expect(resolveDrop(codes, cost.id, interpersonal.id, 'before')).toEqual({
			parentId: trust.id,
			index: 1
		});
		expect(resolveDrop(codes, cost.id, interpersonal.id, 'after')).toEqual({
			parentId: trust.id,
			index: 2
		});
	});

	it('counts the seat with the dragged branch already lifted out', () => {
		// Institutional is the first of Trust's two children. Dropping it after
		// its own next sibling means seat 1 of the one remaining sibling, not the
		// seat 2 the list as drawn would suggest -- the difference between
		// landing where the reader aimed and overshooting by one.
		const { codes, institutional, interpersonal, trust } = fixture();
		expect(resolveDrop(codes, institutional.id, interpersonal.id, 'after')).toEqual({
			parentId: trust.id,
			index: 1
		});
	});

	it('refuses a drop into the dragged code’s own branch', () => {
		const { codes, trust, doctors } = fixture();
		expect(resolveDrop(codes, trust.id, doctors.id, 'inside')).toBeNull();
	});

	it('refuses a drop onto the dragged code itself', () => {
		const { codes, trust } = fixture();
		expect(resolveDrop(codes, trust.id, trust.id, 'inside')).toBeNull();
	});
});

describe('moving a code to a seat', () => {
	it('reorders siblings without changing whose child they are', () => {
		const { codes, trust, interpersonal } = fixture();
		const moved = moveCode(codes, interpersonal.id, trust.id, 0);
		expect(siblingNames(moved, trust.id)).toEqual(['Interpersonal', 'Institutional']);
	});

	it('keeps the flat list in depth-first order after a reorder', () => {
		const { codes, trust, interpersonal } = fixture();
		const moved = moveCode(codes, interpersonal.id, trust.id, 0);
		// The array is the outline; a move that leaves the two disagreeing makes
		// every later diff against a saved codebook noise.
		expect(names(moved)).toEqual(names(outlineOf(moved).map((row) => row.code)));
	});

	it('takes the whole branch along', () => {
		const { codes, institutional, barriers, doctors } = fixture();
		const moved = moveCode(codes, institutional.id, barriers.id, 0);
		expect(siblingNames(moved, barriers.id)).toEqual(['Institutional', 'Cost']);
		expect(siblingNames(moved, institutional.id)).toEqual(['Doctors']);
		expect(moved.find((code) => code.id === doctors.id)?.parentId).toBe(institutional.id);
		expect(moved).toHaveLength(codes.length);
	});

	it('promotes to the top level at the seat asked for', () => {
		const { codes, doctors } = fixture();
		const moved = moveCode(codes, doctors.id, null, 0);
		expect(siblingNames(moved, null)).toEqual(['Doctors', 'Trust', 'Barriers']);
	});

	it('clamps a seat past the last sibling to the end', () => {
		const { codes, cost, trust } = fixture();
		const moved = moveCode(codes, cost.id, trust.id, 99);
		expect(siblingNames(moved, trust.id)).toEqual(['Institutional', 'Interpersonal', 'Cost']);
	});

	it('lands beside its new siblings rather than where it was', () => {
		const { codes, cost, trust } = fixture();
		const moved = moveCode(codes, cost.id, trust.id, 0);
		expect(names(moved)).toEqual([
			'Trust',
			'Cost',
			'Institutional',
			'Doctors',
			'Interpersonal',
			'Barriers'
		]);
	});

	it('refuses a move into its own subtree, unchanged', () => {
		const { codes, trust, doctors } = fixture();
		expect(moveCode(codes, trust.id, doctors.id, 0)).toBe(codes);
	});
});
