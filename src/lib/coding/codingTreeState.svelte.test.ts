import { expect, test } from 'vitest';

import { findCode, subtreeOf } from './codingTree';
import type { CodingTreeState } from './codingTreeState.svelte';
import { seededTree } from './seed';

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
	const tree = seededTree();
	const before = colorOf(tree, TIME);

	expect(tree.moveUnder(TIME, RESPONSIBILITY)).toBe(true);

	expect(colorOf(tree, TIME)).toBe(colorOf(tree, RESPONSIBILITY));
	expect(colorOf(tree, TIME)).not.toBe(before);
});

test('the whole moved subtree is repainted, not just the code itself', () => {
	const tree = seededTree();

	// `Where you live` carries a sub-code of its own.
	expect(subtreeOf(tree.codes, PLACE).length).toBeGreaterThan(1);
	expect(tree.moveUnder(PLACE, RESPONSIBILITY)).toBe(true);

	const branchColor = colorOf(tree, RESPONSIBILITY);
	for (const code of subtreeOf(tree.codes, PLACE)) {
		expect(code.color).toBe(branchColor);
	}
});

test('a code promoted to the top level starts a branch of its own', () => {
	const tree = seededTree();
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
	const tree = seededTree();
	const before = colorOf(tree, TIME);

	tree.moveUnder(TIME, RESPONSIBILITY);
	tree.undo();

	expect(findCode(tree.codes, TIME)?.parentId).toBe(CONSTRAINTS);
	expect(colorOf(tree, TIME)).toBe(before);
});

test('a refused move changes nothing, colour included', () => {
	const tree = seededTree();
	const before = colorOf(tree, CONSTRAINTS);

	// Into its own subtree: the one move the tree has to refuse.
	expect(tree.moveUnder(CONSTRAINTS, 'seed-constraints-place-car')).toBe(false);

	expect(findCode(tree.codes, CONSTRAINTS)?.parentId).toBeNull();
	expect(colorOf(tree, CONSTRAINTS)).toBe(before);
	expect(tree.canUndo).toBe(false);
});

test('rings the code it selects, however it was selected', () => {
	// Which node is ringed lives in the projection, so a selection that does not
	// rebuild it is only half made: the inspector opens on the new code while the
	// canvas goes on ringing the old one. Clicking a node hid this, because there
	// Svelte Flow sets its own selection and the projection only has to agree.
	const tree = seededTree();
	const [first, second] = tree.codes;

	tree.selectedId = first.id;
	expect(tree.nodes.filter((node) => node.selected).map((node) => node.id)).toEqual([first.id]);

	tree.selectedId = second.id;
	expect(tree.nodes.filter((node) => node.selected).map((node) => node.id)).toEqual([second.id]);

	tree.selectedId = null;
	expect(tree.nodes.some((node) => node.selected)).toBe(false);
});

test('rings a code created by dragging off a handle', () => {
	// The gesture that exposed it: the new code is selected, but `addChild`
	// commits before it changes the selection, so the rebuild the commit does
	// still describes the code the reader dragged *from*.
	const tree = seededTree();
	const parent = tree.codes[0];
	tree.selectedId = parent.id;

	const created = tree.addChild(parent.id, { x: 10, y: 20 });

	expect(tree.selectedId).toBe(created);
	expect(tree.nodes.filter((node) => node.selected).map((node) => node.id)).toEqual([created]);
});

test('editing a palette colour moves every branch painted from it', () => {
	const tree = seededTree();
	const before = tree.palette[0];
	const wearing = tree.codes.filter((code) => code.color === before).map((code) => code.id);
	expect(wearing.length).toBeGreaterThan(0);

	tree.setColor(0, '#123456');

	expect(tree.palette[0]).toBe('#123456');
	expect(wearing.every((id) => colorOf(tree, id) === '#123456')).toBe(true);
	// The edges are painted from the codes, so the canvas has to have followed too.
	expect(tree.edges.some((edge) => String(edge.style).includes('#123456'))).toBe(true);
});

test('removing a palette colour repaints its branches, and one undo takes back both', () => {
	const tree = seededTree();
	const removed = tree.palette[1];
	const wearing = tree.codes.filter((code) => code.color === removed).map((code) => code.id);
	expect(wearing.length).toBeGreaterThan(0);

	tree.removeColor(1);

	expect(tree.palette).not.toContain(removed);
	expect(wearing.every((id) => colorOf(tree, id) === tree.palette[0])).toBe(true);

	// The half-undo this guards against: the palette back but the branches still
	// wearing a colour it no longer offers.
	tree.undo();
	expect(tree.palette[1]).toBe(removed);
	expect(wearing.every((id) => colorOf(tree, id) === removed)).toBe(true);
});

test('adding a colour offers one the palette does not already hold', () => {
	const tree = seededTree();
	const added = tree.addColor();

	expect(added).not.toBeNull();
	expect(tree.palette.filter((color) => color === added)).toHaveLength(1);
	// New colours are offered, not applied: nothing is repainted by adding one.
	expect(tree.codes.some((code) => code.color === added)).toBe(false);
});

test('a run of picker movements is one undo', () => {
	const tree = seededTree();
	const before = tree.palette[0];

	tree.setColor(0, '#111111');
	tree.setColor(0, '#222222');
	tree.setColor(0, '#333333');
	tree.undo();

	expect(tree.palette[0]).toBe(before);
});

test('breaking out to the free layout leaves every node where the layout had it', () => {
	const tree = seededTree();
	// Codes added under `auto` are placed by the layout, not by the reader, so
	// they must not carry a position of their own -- one would be read back the
	// moment the reader breaks out, scattering a tree that was tidy a click ago.
	tree.addChild(CONSTRAINTS);
	tree.addRootCode();
	const before = new Map(tree.nodes.map((node) => [node.id, node.position]));

	tree.setLayoutMode('free');

	for (const node of tree.nodes) {
		expect(node.position).toEqual(before.get(node.id));
	}
});

test('a code added under the free layout is placed along the direction the tree runs', () => {
	const tree = seededTree();
	tree.setLayoutMode('free');
	const parent = tree.nodes.find((node) => node.id === CONSTRAINTS)?.position;

	const id = tree.addChild(CONSTRAINTS);

	// Left-to-right is the default, so a sub-code goes to the right of its
	// parent rather than underneath it.
	const added = tree.nodes.find((node) => node.id === id)?.position;
	expect(added?.x).toBeGreaterThan(parent!.x);
});
