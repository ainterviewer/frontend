// The pane's sticky ancestors are a CSS result, not a computed one, so the real
// stylesheet has to be here: without it nothing is positioned and the one thing
// worth checking on screen is not on screen.
import '/src/app.css';

import { page } from 'vitest/browser';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { seededTree } from '$lib/coding/seed';
import CodePanel from './CodePanel.svelte';

/**
 * The code pane on a codebook of its own.
 *
 * Its own, because these tests edit it: a shared fixture would carry one
 * test's rename or drag into the next. Nothing is passed for `book`, so the
 * pane draws without a save indicator and touches no network -- what is under
 * test here is the table, not where its edits go.
 */
function renderPanel() {
	const tree = seededTree();
	render(CodePanel, { tree });
	return tree;
}

/** A side pane's worth of width, and enough height to scroll in. */
const PANE = { width: 420, height: 700 };

test('draws the codebook as a tree, opened on its branches', async () => {
	await page.viewport(PANE.width, PANE.height);
	renderPanel();

	// A top-level code and one of its children: the second only appears if the
	// sub-rows survived the walk and the branch opened.
	await expect.element(page.getByText('Who is responsible').first()).toBeVisible();
	await expect.element(page.getByText('The state and regulation').first()).toBeVisible();

	// A grandchild starts hidden -- the pane opens on the branches, not on
	// everything.
	await expect
		.element(page.getByText('Everyday choices as moral acts').first())
		.not.toBeInTheDocument();
});

test('expand all reaches the leaves, and collapse all takes back the branches', async () => {
	await page.viewport(PANE.width, PANE.height);
	renderPanel();

	await page.getByRole('button', { name: 'Expand all' }).click();
	await expect.element(page.getByText('Everyday choices as moral acts').first()).toBeVisible();

	await page.getByRole('button', { name: 'Collapse all' }).click();
	await expect.element(page.getByText('The state and regulation').first()).not.toBeInTheDocument();
	// The roots stay: collapsing everything must not leave an empty pane.
	await expect.element(page.getByText('Who is responsible').first()).toBeVisible();
});

test('an open branch pins its own row, indented under its ancestors', async () => {
	await page.viewport(PANE.width, PANE.height);
	renderPanel();

	// Sticky is what keeps the reader's place in a deep branch. It is set on the
	// row, offset by its depth, and only for a row with something open under it
	// -- a leaf that stuck would pin a code the rows below it are unrelated to.
	const sticky = Array.from(document.querySelectorAll<HTMLElement>('[data-code-row]')).filter(
		(row) => getComputedStyle(row).position === 'sticky'
	);
	expect(sticky.length).toBeGreaterThan(0);

	const roots = sticky.filter((row) => getComputedStyle(row).top === '0px');
	expect(roots.length).toBeGreaterThan(0);

	const leaves = Array.from(document.querySelectorAll<HTMLElement>('[data-code-row]')).filter(
		(row) => row.parentElement?.getAttribute('aria-expanded') === null
	);
	for (const leaf of leaves) expect(getComputedStyle(leaf).position).not.toBe('sticky');
});

test('double-clicking a row renames the code in place', async () => {
	await page.viewport(PANE.width, PANE.height);
	const tree = renderPanel();

	await page.getByText('Who is responsible').first().dblClick();

	const field = page.getByRole('textbox');
	await expect.element(field).toBeVisible();
	await field.fill('Attribution');

	expect(tree.codes.some((code) => code.name === 'Attribution')).toBe(true);
});

test('adding a code opens the branch it lands in and starts naming it', async () => {
	await page.viewport(PANE.width, PANE.height);
	const tree = renderPanel();

	await page.getByRole('button', { name: 'Expand all' }).click();
	await page.getByText('Everyday choices as moral acts').first().click();
	await page.getByRole('button', { name: 'Sub-code' }).click();

	// The new code is created under the selection, and the caret is already in
	// its name -- a code called `New sub-code` is not yet a code.
	const field = page.getByRole('textbox');
	await expect.element(field).toBeVisible();
	await expect.element(field).toHaveValue('New sub-code');

	const parent = tree.codes.find((code) => code.name === 'Everyday choices as moral acts');
	expect(tree.codes.some((code) => code.parentId === parent?.id)).toBe(true);
});

test('a chevron closes its own branch and leaves every other one alone', async () => {
	// The pane used to hand its expansion state to TanStack and read back what
	// `onExpandedChange` gave it, which was the table's own copy and not the
	// pane's -- so one chevron closed the whole tree and nothing would reopen.
	await page.viewport(PANE.width, PANE.height);
	renderPanel();

	await page.getByRole('button', { name: 'Collapse Who is responsible' }).click();

	// Its own children are gone...
	await expect.element(page.getByText('Individual responsibility').first()).not.toBeInTheDocument();
	// ...and the next branch's are still there.
	await expect.element(page.getByText('Cost and household economy').first()).toBeVisible();

	// And it opens again, which the bug also took away.
	await page.getByRole('button', { name: 'Expand Who is responsible' }).click();
	await expect.element(page.getByText('Individual responsibility').first()).toBeVisible();
});

/** The row element for a code, by the name it draws. */
function rowFor(name: string): HTMLElement {
	const row = Array.from(document.querySelectorAll<HTMLElement>('[data-code-row]')).find((el) =>
		el.textContent?.includes(name)
	);
	if (!row) throw new Error(`no row for ${name}`);
	return row;
}

/**
 * A drag from one row's handle to a point in another row.
 *
 * Real pointer events at real coordinates, because the pane resolves its drop
 * target with `document.elementFromPoint` -- a synthetic event carrying the
 * right target but the wrong coordinates would pass through the code under
 * test without exercising any of it.
 */
async function dragOnto(from: string, to: string, fraction: number) {
	const handle = rowFor(from).querySelector('button');
	if (!handle) throw new Error(`no handle for ${from}`);
	const target = rowFor(to).getBoundingClientRect();
	const x = target.left + target.width / 2;
	const y = target.top + target.height * fraction;

	const start = handle.getBoundingClientRect();
	handle.dispatchEvent(
		new PointerEvent('pointerdown', {
			bubbles: true,
			clientX: start.left + start.width / 2,
			clientY: start.top + start.height / 2
		})
	);
	window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: x, clientY: y }));
	window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: x, clientY: y }));
	await new Promise((resolve) => setTimeout(resolve, 50));
}

test('dragging a code onto another nests it, and leaves the tree open', async () => {
	await page.viewport(PANE.width, PANE.height);
	const tree = renderPanel();

	// The middle of a row means "under this one".
	await dragOnto('Rapport', 'Positioning oneself', 0.5);

	const moved = tree.codes.find((code) => code.name === 'Rapport');
	const parent = tree.codes.find((code) => code.name === 'Positioning oneself');
	expect(moved?.parentId).toBe(parent?.id);
	// Repainted into the branch it landed in -- colour means "same branch".
	expect(moved?.color).toBe(parent?.color);

	// The branches the reader had open are still open: a move rewrites the whole
	// codebook, and expansion keyed by anything but the code id would not
	// survive it.
	await expect.element(page.getByText('Cost and household economy').first()).toBeVisible();
	await expect.element(page.getByText('Rapport').first()).toBeVisible();
});

test('dragging onto a row’s edge reorders without changing the parent', async () => {
	await page.viewport(PANE.width, PANE.height);
	const tree = renderPanel();

	const before = tree.codes.find((code) => code.name === 'Elaboration')?.parentId;
	// The top of a row means "into the gap above it".
	await dragOnto('Interviewer steering', 'Elaboration', 0.05);

	const moved = tree.codes.find((code) => code.name === 'Interviewer steering');
	expect(moved?.parentId).toBe(before);

	const siblings = tree.codes.filter((code) => code.parentId === before).map((code) => code.name);
	expect(siblings[0]).toBe('Interviewer steering');
});
