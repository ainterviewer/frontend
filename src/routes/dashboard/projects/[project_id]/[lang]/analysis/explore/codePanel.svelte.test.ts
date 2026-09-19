// The pane's sticky ancestors are a CSS result, not a computed one, so the real
// stylesheet has to be here: without it nothing is positioned and the one thing
// worth checking on screen is not on screen.
import '/src/app.css';

import { expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { seededTree } from '$lib/coding/seed';

import CodePanel from './CodePanel.svelte';
import { type CoverageAxes, defaultCoverage } from './explore';

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

	// The row's own input rather than "the textbox": selecting a row also opens
	// its notes, and those are textboxes too.
	const field = page.getByRole('textbox', { name: 'Rename Who is responsible' });
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
	const field = page.getByRole('textbox', { name: 'Rename New sub-code' });
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

/**
 * Filtering from a row.
 *
 * The keyword box is where a code filter lives, so what these check is that a
 * click writes the right reference into it and a second click takes the same
 * one out. `codeFilter.test.ts` covers what gets written; this covers that the
 * row is wired to it and says which state it is in.
 */
function renderFiltering(keyword = '') {
	const tree = seededTree();
	const box = $state({ keyword });
	render(CodePanel, {
		tree,
		get keyword() {
			return box.keyword;
		},
		set keyword(next: string) {
			box.keyword = next;
		}
	});
	return box;
}

test('filtering by a leaf writes its reference into the keyword box', async () => {
	await page.viewport(PANE.width, PANE.height);
	const box = renderFiltering();

	await page.getByRole('button', { name: 'Filter to The state and regulation' }).click();

	expect(box.keyword).toBe('code:"The state and regulation"');
});

test('filtering by a branch takes the branch', async () => {
	await page.viewport(PANE.width, PANE.height);
	const box = renderFiltering();

	// The label says so before the click does it: a branch picked from a
	// codebook almost always means the branch.
	await page
		.getByRole('button', { name: 'Filter to Who is responsible and everything under it' })
		.click();

	expect(box.keyword).toBe('code:"Who is responsible"/*');
});

test('a filtering row says so, and a second click takes it back out', async () => {
	await page.viewport(PANE.width, PANE.height);
	const box = renderFiltering();

	const on = page.getByRole('button', { name: 'Filter to The state and regulation' });
	await on.click();

	const off = page.getByRole('button', { name: 'Stop filtering by The state and regulation' });
	await expect.element(off).toHaveAttribute('aria-pressed', 'true');

	await off.click();
	expect(box.keyword).toBe('');
});

test('a reference already in the box is shown as filtering without a click', async () => {
	await page.viewport(PANE.width, PANE.height);
	renderFiltering('code:"The state and regulation"');

	await expect
		.element(page.getByRole('button', { name: 'Stop filtering by The state and regulation' }))
		.toHaveAttribute('aria-pressed', 'true');
});

test('filtering by a second code narrows to both', async () => {
	await page.viewport(PANE.width, PANE.height);
	const box = renderFiltering('kids');

	await page.getByRole('button', { name: 'Filter to The state and regulation' }).click();

	// Adjacency is AND: two codes picked from a codebook mean what carries both.
	expect(box.keyword).toBe('kids code:"The state and regulation"');
});

/**
 * Coverage: who has coded what.
 *
 * One row of toggles per axis, because the three do not factor into fewer.
 * `explore.test.ts` covers what a combination means; these cover that the rows
 * set the axes and that a recognised combination says its name.
 */
function renderCoverage(coverage: CoverageAxes = defaultCoverage()) {
	const tree = seededTree();
	const box = $state<{ coverage: CoverageAxes }>({ coverage });
	render(CodePanel, {
		tree,
		get coverage() {
			return box.coverage;
		},
		set coverage(next: CoverageAxes) {
			box.coverage = next;
		}
	});
	return box;
}

test('each row sets its own axis', async () => {
	await page.viewport(PANE.width, PANE.height);
	const box = renderCoverage();

	const mine = page.getByRole('group', { name: 'Mine' });
	await mine.getByRole('button', { name: 'Uncoded', exact: true }).click();
	expect(box.coverage).toEqual({ mine: 'none', others: null, join: 'and' });

	const others = page.getByRole('group', { name: 'Others' });
	await others.getByRole('button', { name: 'Coded', exact: true }).click();
	expect(box.coverage).toEqual({ mine: 'none', others: 'any', join: 'and' });
});

test('a recognised combination says what it is called', async () => {
	await page.viewport(PANE.width, PANE.height);
	renderCoverage({ mine: 'none', others: 'any', join: 'and' });

	// "mine: uncoded, others: coded" is the second-coder pass, and says so to
	// nobody until it is named.
	await expect.element(page.getByText('To review', { exact: false })).toBeVisible();
});

test('a combination with no name says nothing', async () => {
	await page.viewport(PANE.width, PANE.height);
	renderCoverage({ mine: null, others: 'none', join: 'or' });

	await expect.element(page.getByText('To review', { exact: false })).not.toBeInTheDocument();
	await expect.element(page.getByText('Only me', { exact: false })).not.toBeInTheDocument();
});

test('the operator turns the grid into its own complement', async () => {
	await page.viewport(PANE.width, PANE.height);
	const box = renderCoverage({ mine: 'any', others: 'any', join: 'and' });

	// "Coded by both" is the quadrant; flipping the operator asks for its
	// complement, which is "somebody has coded this" -- the one reading a
	// conjunction of the two rows cannot give.
	await page.getByRole('group', { name: 'Join' }).getByRole('button', { name: 'OR' }).click();

	expect(box.coverage).toEqual({ mine: 'any', others: 'any', join: 'or' });
	await expect.element(page.getByText('Coded by anyone', { exact: false })).toBeVisible();
});

test('the operator says so when it is joining nothing', async () => {
	await page.viewport(PANE.width, PANE.height);
	renderCoverage({ mine: 'any', others: null, join: 'and' });

	// `or` over one condition is that condition, so until both rows are set it
	// decides nothing and should not look as though it does.
	await expect.element(page.getByText('Set both rows to join them')).toBeVisible();
});

test('the operator divides on the line between Coded and Uncoded', async () => {
	await page.viewport(PANE.width, PANE.height);
	renderCoverage({ mine: 'any', others: 'any', join: 'and' });

	// Alignment is the whole point of where it sits, and it is held by
	// mirroring the segments' own labels rather than by a measured offset --
	// exactly the kind of thing that slips silently. Deliberately the *seam*
	// between Coded and Uncoded and not the middle of the pair: the two
	// segments are different widths, so those are different places, and the
	// seam is the line the eye follows down the column.
	const mine = page.getByRole('group', { name: 'Mine' });
	const coded = mine.getByRole('button', { name: 'Coded', exact: true }).element();
	const uncoded = mine.getByRole('button', { name: 'Uncoded', exact: true }).element();
	const join = page.getByRole('group', { name: 'Join' }).element();

	const seam = coded.getBoundingClientRect().right;
	const [and, or] = [...join.querySelectorAll('button')].map((button) =>
		button.getBoundingClientRect()
	);

	// Meaningless unless the seam is one line to begin with.
	expect(Math.abs(seam - uncoded.getBoundingClientRect().left)).toBeLessThan(1);

	// The operator's own divider on it, not the operator's centre: AND is a
	// wider word than OR, so those are a few pixels apart and only one of them
	// is a line running down all three rows.
	expect(Math.abs(seam - and.right)).toBeLessThan(1);
	expect(Math.abs(seam - or.left)).toBeLessThan(1);
});

test('the operator stays out of the way until both rows are set', async () => {
	await page.viewport(PANE.width, PANE.height);
	renderCoverage({ mine: 'none', others: 'any', join: 'and' });

	await expect.element(page.getByText('Set both rows to join them')).not.toBeInTheDocument();
});

/**
 * The badges.
 *
 * What a number *is* is settled on the server; what this checks is the one
 * rule the pane owns -- which of the two numbers a row shows, and when it
 * shows both.
 */
function renderCounted(counts: Record<string, { count: number; subtree: number }>) {
	const tree = seededTree();
	const idOf = (name: string) => tree.codes.find((code) => code.name === name)?.id ?? '';
	render(CodePanel, {
		tree,
		countOf: (id: string) => {
			const entry = Object.entries(counts).find(([name]) => idOf(name) === id);
			return entry ? entry[1] : null;
		}
	});
	return tree;
}

test('a leaf shows one number', async () => {
	await page.viewport(PANE.width, PANE.height);
	renderCounted({ 'The state and regulation': { count: 4, subtree: 4 } });

	await expect.element(page.getByText('4', { exact: true }).first()).toBeVisible();
	// Not the wide form: the two numbers agree, and `4 · 4` is width this pane
	// does not have to spend.
	await expect.element(page.getByText('4 · 4').first()).not.toBeInTheDocument();
});

test('a branch shows its own count beside the branch total', async () => {
	await page.viewport(PANE.width, PANE.height);
	renderCounted({ 'Who is responsible': { count: 2, subtree: 9 } });

	await expect.element(page.getByText('2 · 9').first()).toBeVisible();
});

test('a code nothing in view carries shows no badge at all', async () => {
	await page.viewport(PANE.width, PANE.height);
	renderCounted({});

	// Drawn as nothing rather than as a zero, so the rows with ink on them are
	// the ones with something to say.
	await expect.element(page.getByText('0', { exact: true }).first()).not.toBeInTheDocument();
});

test('a group shows only its branch, because it is never applied', async () => {
	await page.viewport(PANE.width, PANE.height);
	renderCounted({ 'How the interview went': { count: 0, subtree: 12 } });

	await expect.element(page.getByText('12', { exact: true }).first()).toBeVisible();
	// `0 · 12` is what the ordinary rule would print, and the zero says nothing:
	// a group organises the branch under it and never carries a coding itself.
	await expect.element(page.getByText('0 · 12').first()).not.toBeInTheDocument();
});

/**
 * Searching *from* a code.
 *
 * Two actions behind one opener, because they answer two different questions:
 * what the code says it is, and what it has become in use. The pane only
 * reports which was chosen on which code; what either does to the list is the
 * page's.
 */
function renderSearchable(counts: Record<string, { count: number; subtree: number }> = {}) {
	const tree = seededTree();
	const idOf = (name: string) => tree.codes.find((code) => code.name === name)?.id ?? '';
	const chosen: { action: string; name: string; subtree?: boolean }[] = [];
	render(CodePanel, {
		tree,
		countOf: (id: string) => {
			const entry = Object.entries(counts).find(([name]) => idOf(name) === id);
			return entry ? entry[1] : null;
		},
		ondefine: (code) => chosen.push({ action: 'define', name: code.name }),
		onlike: (code, subtree) => chosen.push({ action: 'like', name: code.name, subtree })
	});
	return chosen;
}

test('a row offers both ways of searching from its code', async () => {
	await page.viewport(PANE.width, PANE.height);
	const chosen = renderSearchable({ 'The state and regulation': { count: 3, subtree: 3 } });

	await page.getByRole('button', { name: 'Search from The state and regulation' }).click();
	await page.getByText('Search by definition').click();

	expect(chosen).toEqual([{ action: 'define', name: 'The state and regulation' }]);
});

test('finding more like a branch takes the branch', async () => {
	await page.viewport(PANE.width, PANE.height);
	const chosen = renderSearchable({ 'Who is responsible': { count: 1, subtree: 9 } });

	await page.getByRole('button', { name: 'Search from Who is responsible' }).click();
	await page.getByText('Find more like these').click();

	// A row with children filters as a branch, so it has to seed as one too --
	// otherwise the action and the count beside it describe different sets.
	expect(chosen).toEqual([{ action: 'like', name: 'Who is responsible', subtree: true }]);
});

test('a code nothing carries cannot be asked what it is like', async () => {
	await page.viewport(PANE.width, PANE.height);
	renderSearchable();

	await page.getByRole('button', { name: 'Search from The state and regulation' }).click();

	// Offered rather than hidden, with the reason in the line under it: the
	// action is real and the way to earn it is to code something.
	await expect.element(page.getByText('Nothing carries it yet', { exact: false })).toBeVisible();
});

test('the menu is absent where there is nothing for it to search', async () => {
	await page.viewport(PANE.width, PANE.height);
	renderPanel();

	// The pane is also drawn against a codebook with no corpus behind it, and
	// an action that goes nowhere is worse than one that is not offered.
	await expect
		.element(page.getByRole('button', { name: 'Search from The state and regulation' }))
		.not.toBeInTheDocument();
});

/**
 * Letting go of a selected row.
 *
 * A selection is a target — it decides what *+ Sub-code* nests under and what
 * the delete button removes — so being unable to clear it leaves the reader
 * aiming at something they have finished with.
 */
test('escape lets go of the selected row', async () => {
	await page.viewport(PANE.width, PANE.height);
	const tree = renderPanel();

	await page.getByText('Who is responsible').first().click();
	expect(tree.selectedId).not.toBeNull();

	window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
	expect(tree.selectedId).toBeNull();
});

test('clicking away from the pane lets go too', async () => {
	await page.viewport(PANE.width, PANE.height);
	const tree = renderPanel();

	await page.getByText('Who is responsible').first().click();
	expect(tree.selectedId).not.toBeNull();

	document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
	expect(tree.selectedId).toBeNull();
});

test('the pane’s own controls are not “away”', async () => {
	await page.viewport(PANE.width, PANE.height);
	const tree = renderPanel();

	await page.getByText('Who is responsible').first().click();
	const selected = tree.selectedId;

	// *+ Sub-code* acts on the selection, so clearing before its handler ran
	// would take the target out from under it.
	page
		.getByRole('button', { name: 'Sub-code' })
		.element()
		.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));

	expect(tree.selectedId).toBe(selected);
});

test('a score shows its kind as an icon alone', async () => {
	await page.viewport(PANE.width, PANE.height);
	renderPanel();

	// The range used to print beside the icon, which made one row wider than
	// its siblings and pushed the column out of line. Still on hover.
	await expect.element(page.getByText('1–5', { exact: true })).not.toBeInTheDocument();
});

/**
 * The trailing slot.
 *
 * The count and the row's buttons share one grid cell, so the cell is as wide
 * as the wider of the two and never as wide as both. Before that they sat side
 * by side and the buttons appeared out of nothing on hover, which shoved the
 * count leftwards on every pass of the mouse.
 */
test('the count and the row’s actions share one slot', async () => {
	await page.viewport(PANE.width, PANE.height);
	renderSearchable({ 'The state and regulation': { count: 3, subtree: 3 } });

	const row = [...document.querySelectorAll<HTMLElement>('[data-code-row]')].find((one) =>
		one.textContent?.includes('The state and regulation')
	)!;
	const count = [...row.querySelectorAll('span')].find((span) => span.textContent?.trim() === '3')!;
	const actions = row.querySelector<HTMLElement>('[aria-pressed]')!.parentElement!;

	// Stacked, not sequential: right edges coincide because both are laid to
	// the end of the same cell. Side by side they could not.
	expect(
		Math.abs(count.getBoundingClientRect().right - actions.getBoundingClientRect().right)
	).toBeLessThan(1);
});

test('a row that is filtering shows its buttons at rest', async () => {
	await page.viewport(PANE.width, PANE.height);
	const tree = seededTree();
	const name = 'The state and regulation';
	render(CodePanel, { tree, keyword: `code:"${name}"` });

	const pressed = [...document.querySelectorAll<HTMLElement>('[aria-pressed="true"]')].find(
		(button) => button.getAttribute('aria-label')?.includes(name)
	)!;

	// A filter narrowing everything on screen has to be visible without
	// hovering to find it — this row is where a reader would look to turn it
	// off. Nothing here is hovered, so an opacity of 1 is the claim.
	expect(getComputedStyle(pressed.parentElement!).opacity).toBe('1');
});

/**
 * The notes under the tree.
 *
 * Definition and memo only — the codebook page keeps the whole editor, and a
 * second one of those would be two places to recolour a branch and two places
 * to delete a code. These two are the pair written while *reading* rather than
 * while planning.
 */
test('selecting a row opens its definition and memo', async () => {
	await page.viewport(PANE.width, PANE.height);
	renderPanel();

	await expect.element(page.getByRole('textbox', { name: 'Definition' })).not.toBeInTheDocument();

	await page.getByText('Who is responsible').first().click();

	await expect.element(page.getByRole('textbox', { name: 'Definition' })).toBeVisible();
	await expect.element(page.getByRole('textbox', { name: 'Memo' })).toBeVisible();
});

test('typing a memo writes it to the codebook', async () => {
	await page.viewport(PANE.width, PANE.height);
	const tree = renderPanel();

	await page.getByText('Who is responsible').first().click();
	await page.getByRole('textbox', { name: 'Memo' }).fill('#43 is borderline');

	const code = tree.codes.find((one) => one.name === 'Who is responsible');
	expect(code?.memo).toBe('#43 is borderline');
});

test('escape leaves the field before it lets go of the row', async () => {
	await page.viewport(PANE.width, PANE.height);
	const tree = renderPanel();

	await page.getByText('Who is responsible').first().click();
	const memo = page.getByRole('textbox', { name: 'Memo' });
	await memo.click();

	// The first press is the field's, so a reader who hits escape mid-sentence
	// keeps what they wrote open in front of them.
	memo.element().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
	expect(tree.selectedId).not.toBeNull();

	// The second lets go of the row, which is the ordinary two-step.
	window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
	expect(tree.selectedId).toBeNull();
});

test('clicking away while writing does not close the notes', async () => {
	await page.viewport(PANE.width, PANE.height);
	const tree = renderPanel();

	await page.getByText('Who is responsible').first().click();
	await page.getByRole('textbox', { name: 'Definition' }).click();

	// Clicking a transcript to check the passage being written *about* is the
	// commonest reason to leave the pane mid-sentence.
	document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));

	expect(tree.selectedId).not.toBeNull();
});
