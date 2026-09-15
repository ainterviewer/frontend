import { expect, test } from 'vitest';
import { findCode, subtreeOf } from './codingTree';
import { CodingTreeState } from './codingTreeState.svelte';

/**
 * The state class is where moving and colouring meet, so it is tested here
 * rather than alongside the pure tree operations. Runes need a compiled module,
 * which is what puts this file in the browser project; nothing here renders.
 */

/** Seed ids, from `seed.ts`. */
const RESPONSIBILITY = 'seed-responsibility';
const CONSTRAINTS = 'seed-constraints';
const TIME = 'seed-constraints-time';
/** A code with sub-codes of its own, so a move has a subtree to carry. */
const PLACE = 'seed-constraints-place';

const colorOf = (tree: CodingTreeState, id: string) => findCode(tree.codes, id)?.color;

test('a code moved into another branch takes that branch’s colour', () => {
	const tree = new CodingTreeState();
	const before = colorOf(tree, TIME);

	expect(tree.moveUnder(TIME, RESPONSIBILITY)).toBe(true);

	expect(colorOf(tree, TIME)).toBe(colorOf(tree, RESPONSIBILITY));
	expect(colorOf(tree, TIME)).not.toBe(before);
});

test('the whole moved subtree is repainted, not just the code itself', () => {
	const tree = new CodingTreeState();

	// `Where you live` carries a sub-code of its own.
	expect(subtreeOf(tree.codes, PLACE).length).toBeGreaterThan(1);
	expect(tree.moveUnder(PLACE, RESPONSIBILITY)).toBe(true);

	const branchColor = colorOf(tree, RESPONSIBILITY);
	for (const code of subtreeOf(tree.codes, PLACE)) {
		expect(code.color).toBe(branchColor);
	}
});

test('a code promoted to the top level starts a branch of its own', () => {
	const tree = new CodingTreeState();
	const parentColor = colorOf(tree, CONSTRAINTS);

	expect(tree.moveUnder(TIME, null)).toBe(true);

	// A new branch, so neither the hue it inherited nor any other branch's.
	expect(colorOf(tree, TIME)).not.toBe(parentColor);
	const otherRootColors = tree.codes
		.filter((code) => code.parentId === null && code.id !== TIME)
		.map((code) => code.color);
	expect(otherRootColors).not.toContain(colorOf(tree, TIME));
});

test('one undo takes back both the move and the repaint', () => {
	const tree = new CodingTreeState();
	const before = colorOf(tree, TIME);

	tree.moveUnder(TIME, RESPONSIBILITY);
	tree.undo();

	expect(findCode(tree.codes, TIME)?.parentId).toBe(CONSTRAINTS);
	expect(colorOf(tree, TIME)).toBe(before);
});

test('a refused move changes nothing, colour included', () => {
	const tree = new CodingTreeState();
	const before = colorOf(tree, CONSTRAINTS);

	// Into its own subtree: the one move the tree has to refuse.
	expect(tree.moveUnder(CONSTRAINTS, 'seed-constraints-place-car')).toBe(false);

	expect(findCode(tree.codes, CONSTRAINTS)?.parentId).toBeNull();
	expect(colorOf(tree, CONSTRAINTS)).toBe(before);
	expect(tree.canUndo).toBe(false);
});
