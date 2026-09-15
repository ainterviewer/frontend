import { expect, test } from 'vitest';
import { findCode, subtreeOf } from './codingTree';
import { CodingTreeState } from './codingTreeState.svelte';

/**
 * The state class is where moving and colouring meet, so it is tested here
 * rather than alongside the pure tree operations. Runes need a compiled module,
 * which is what puts this file in the browser project; nothing here renders.
 */

/** Seed ids, from `seed.ts`. */
const TRUST = 'seed-trust';
const LANGUAGE = 'seed-language';
const LETTERS = 'seed-language-letters';
const BOOKING = 'seed-access-booking';

const colorOf = (tree: CodingTreeState, id: string) => findCode(tree.codes, id)?.color;

test('a code moved into another branch takes that branch’s colour', () => {
	const tree = new CodingTreeState();
	const before = colorOf(tree, LETTERS);

	expect(tree.moveUnder(LETTERS, TRUST)).toBe(true);

	expect(colorOf(tree, LETTERS)).toBe(colorOf(tree, TRUST));
	expect(colorOf(tree, LETTERS)).not.toBe(before);
});

test('the whole moved subtree is repainted, not just the code itself', () => {
	const tree = new CodingTreeState();

	// `Booking and queues` carries two sub-codes of its own.
	expect(subtreeOf(tree.codes, BOOKING).length).toBeGreaterThan(1);
	expect(tree.moveUnder(BOOKING, TRUST)).toBe(true);

	const trustColor = colorOf(tree, TRUST);
	for (const code of subtreeOf(tree.codes, BOOKING)) {
		expect(code.color).toBe(trustColor);
	}
});

test('a code promoted to the top level starts a branch of its own', () => {
	const tree = new CodingTreeState();
	const parentColor = colorOf(tree, LANGUAGE);

	expect(tree.moveUnder(LETTERS, null)).toBe(true);

	// A new branch, so neither the hue it inherited nor any other branch's.
	expect(colorOf(tree, LETTERS)).not.toBe(parentColor);
	const otherRootColors = tree.codes
		.filter((code) => code.parentId === null && code.id !== LETTERS)
		.map((code) => code.color);
	expect(otherRootColors).not.toContain(colorOf(tree, LETTERS));
});

test('one undo takes back both the move and the repaint', () => {
	const tree = new CodingTreeState();
	const before = colorOf(tree, LETTERS);

	tree.moveUnder(LETTERS, TRUST);
	tree.undo();

	expect(findCode(tree.codes, LETTERS)?.parentId).toBe(LANGUAGE);
	expect(colorOf(tree, LETTERS)).toBe(before);
});

test('a refused move changes nothing, colour included', () => {
	const tree = new CodingTreeState();
	const before = colorOf(tree, TRUST);

	// Into its own subtree: the one move the tree has to refuse.
	expect(tree.moveUnder(TRUST, 'seed-trust-institutional')).toBe(false);

	expect(findCode(tree.codes, TRUST)?.parentId).toBeNull();
	expect(colorOf(tree, TRUST)).toBe(before);
	expect(tree.canUndo).toBe(false);
});
