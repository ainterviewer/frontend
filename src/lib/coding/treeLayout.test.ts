import { describe, expect, it } from 'vitest';

import { createCode } from './codingTree';
import { dropTargetId, layoutCodes, NODE_HEIGHT, NODE_WIDTH } from './treeLayout';

describe('dropTargetId', () => {
	const at = (id: string, x: number, y: number) => ({ id, position: { x, y } });

	it('finds nothing when the dragged node is clear of the others', () => {
		expect(dropTargetId(at('a', 0, 0), [at('b', 1000, 1000)])).toBeNull();
	});

	it('ignores a graze', () => {
		// Overlapping by a tenth of the node in each direction: a corner clip.
		expect(dropTargetId(at('a', 0, 0), [at('b', NODE_WIDTH * 0.9, NODE_HEIGHT * 0.9)])).toBeNull();
	});

	it('picks the node it sits on top of', () => {
		expect(dropTargetId(at('a', 10, 10), [at('b', 0, 0), at('c', 900, 0)])).toBe('b');
	});

	it('picks the more covered of two candidates', () => {
		const dragged = at('a', 0, 0);
		const nearly = at('b', NODE_WIDTH * 0.2, 0);
		const barely = at('c', -NODE_WIDTH * 0.6, 0);
		expect(dropTargetId(dragged, [barely, nearly])).toBe('b');
	});

	it('never targets the dragged node itself', () => {
		expect(dropTargetId(at('a', 0, 0), [at('a', 0, 0)])).toBeNull();
	});
});

describe('layoutCodes', () => {
	it('puts a child below its parent when the tree runs top-down', () => {
		const parent = createCode({ name: 'Parent' });
		const child = createCode({ parentId: parent.id, name: 'Child' });
		const positions = layoutCodes([parent, child], 'TB');
		expect(positions.get(child.id)!.y).toBeGreaterThan(positions.get(parent.id)!.y);
	});

	it('puts a child to the right of its parent when the tree runs left-to-right', () => {
		const parent = createCode({ name: 'Parent' });
		const child = createCode({ parentId: parent.id, name: 'Child' });
		const positions = layoutCodes([parent, child], 'LR');
		expect(positions.get(child.id)!.x).toBeGreaterThan(positions.get(parent.id)!.x);
	});

	it('leaves siblings far enough apart not to overlap', () => {
		const parent = createCode({ name: 'Parent' });
		const first = createCode({ parentId: parent.id, name: 'First' });
		const second = createCode({ parentId: parent.id, name: 'Second' });
		const positions = layoutCodes([parent, first, second], 'TB');
		const gap = Math.abs(positions.get(first.id)!.x - positions.get(second.id)!.x);
		expect(gap).toBeGreaterThanOrEqual(NODE_WIDTH);
	});
});
