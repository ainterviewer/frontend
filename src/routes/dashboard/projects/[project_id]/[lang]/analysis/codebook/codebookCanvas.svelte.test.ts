// The canvas is laid out by CSS, so the real stylesheet has to be here: without
// it the flow pane collapses to no height and every node lands on top of the
// toolbar, which is a fact about the test, not about the page.
import '/src/app.css';

import { page } from 'vitest/browser';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { seededTree } from '$lib/coding/seed';
import CodebookWorkspace from './CodebookWorkspace.svelte';

/**
 * The canvas is the one part of this feature that cannot be checked by reasoning
 * about the codebook: Svelte Flow has to measure a pane, run the layout and draw
 * nodes for any of it to be true. So this renders the real workspace in a real
 * browser and asserts the seed codebook arrives on screen and answers a click.
 */

/** A dashboard-sized window; the default is a phone, where the inspector alone
 * leaves the canvas 90px wide. */
const DESKTOP = { width: 1280, height: 900 };

/**
 * The workspace on a codebook of its own.
 *
 * The workspace rather than the route's page, because the page's job is
 * loading, saving and failing -- it would put this suite behind a network
 * call, and a canvas that draws is what these tests are about. Each render
 * gets its own tree for the same reason each used to get its own project id:
 * the second test renames a code, and a shared fixture would carry that into
 * the third.
 */
function renderPage() {
	return render(CodebookWorkspace, { tree: seededTree() });
}

test('draws the seed codebook and opens the inspector on a code', async () => {
	await page.viewport(DESKTOP.width, DESKTOP.height);
	renderPage();

	const responsibility = page.getByText('Who is responsible').first();
	await expect.element(responsibility).toBeVisible();
	await expect.element(page.getByText('What makes acting hard').first()).toBeVisible();

	// A node carries its sub-code count, which only appears if the parent links
	// survived the projection into nodes and edges.
	await expect.element(page.getByText('3 sub-codes').first()).toBeVisible();

	await responsibility.click();

	// The inspector opens on the clicked code, with its definition loaded.
	const definition = page.getByPlaceholder('What counts as this code? What does not?');
	await expect.element(definition).toBeVisible();
	await expect
		.element(definition)
		.toHaveValue(
			'Passages where the participant assigns responsibility for acting on climate change to somebody — themselves, the state, industry, other countries. Requires an attribution, not merely a complaint.'
		);
});

test('renaming a code in the inspector renames it on the canvas', async () => {
	await page.viewport(DESKTOP.width, DESKTOP.height);
	renderPage();

	await page.getByText('The interview as a situation').first().click();
	const name = page.getByPlaceholder('Untitled code');
	await expect.element(name).toBeVisible();
	await name.fill('Interview artefacts');

	await expect.element(page.getByText('Interview artefacts').first()).toBeVisible();
});

test('no ancestor clips the connection handles', async () => {
	await page.viewport(DESKTOP.width, DESKTOP.height);
	renderPage();

	await expect.element(page.getByText('Who is responsible').first()).toBeVisible();

	// Handles straddle the card's edge, so half of each one sits outside it. An
	// ancestor with `overflow: hidden` clips that half away, and a clipped area
	// does not answer the pointer -- which silently loses half the target for
	// both gestures that start at a handle. The bug is invisible on screen,
	// because the visible dot is drawn either way, so it is worth pinning here.
	const clipped = Array.from(document.querySelectorAll('.svelte-flow__handle')).filter((handle) => {
		for (
			let el = handle.parentElement;
			el && !el.classList.contains('svelte-flow__node');
			el = el.parentElement
		) {
			const { overflow } = getComputedStyle(el);
			if (overflow !== 'visible') return true;
		}
		return false;
	});

	expect(clipped).toHaveLength(0);
});

test('leaves the caret where the reader is typing', async () => {
	// Every edit replaces the code object the inspector is given, so anything in
	// this panel that reacts to the code as a whole re-runs between keystrokes.
	// The one that steals focus is only visible as this: a field that takes the
	// first character of a word and loses the rest to the name at the top.
	await page.viewport(DESKTOP.width, DESKTOP.height);
	renderPage();

	await page.getByText('Who is responsible').first().click();

	const definition = page.getByPlaceholder('What counts as this code? What does not?');
	await definition.fill('');
	await definition.fill('Passages where');

	await expect.element(definition).toHaveValue('Passages where');
	expect(document.activeElement).toBe(definition.element());
});

test('keeps focus in a score range while it is being typed', async () => {
	await page.viewport(DESKTOP.width, DESKTOP.height);
	renderPage();

	await page.getByText('Elaboration').first().click();

	// The second number field is the top of the scale; the first is its floor.
	const max = page.getByRole('spinbutton').nth(1);
	await max.fill('10');

	await expect.element(max).toHaveValue(10);
	expect(document.activeElement).toBe(max.element());
});

test('a single click opens a code without taking the caret', async () => {
	// Selecting is how the reader opens a code to *read* it. Focusing the name
	// on selection makes the panel unusable with the keyboard: every subsequent
	// keystroke has to be aimed back at the field it was taken from.
	await page.viewport(DESKTOP.width, DESKTOP.height);
	renderPage();

	await page.getByText('Who is responsible').first().click();

	const name = page.getByPlaceholder('Untitled code');
	await expect.element(name).toBeVisible();
	expect(document.activeElement).not.toBe(name.element());
});

test('a double click on a node selects the name, ready to be typed over', async () => {
	await page.viewport(DESKTOP.width, DESKTOP.height);
	renderPage();

	await page.getByText('Who is responsible').first().dblClick();

	const name = page.getByPlaceholder('Untitled code').element() as HTMLInputElement;
	expect(document.activeElement).toBe(name);
	// Selected, not merely focused: a double click is a rename, and the name it
	// lands on is one the reader has already decided is wrong.
	expect(name.selectionStart).toBe(0);
	expect(name.selectionEnd).toBe(name.value.length);
});

test('a new code lands in the name field', async () => {
	await page.viewport(DESKTOP.width, DESKTOP.height);
	renderPage();

	await page.getByRole('button', { name: 'New code' }).click();

	const name = page.getByPlaceholder('Untitled code').element() as HTMLInputElement;
	expect(document.activeElement).toBe(name);
	expect(name.value).toBe('New code');
});

test('a rename does not outlive the panel that was asked for it', async () => {
	// The inspector is unmounted whenever nothing is selected, so a rename
	// request that is never consumed comes back to life with the next panel:
	// rename, click away, click anything, and an ordinary click opened an edit.
	await page.viewport(DESKTOP.width, DESKTOP.height);
	renderPage();

	await page.getByText('Who is responsible').first().dblClick();
	await expect.element(page.getByPlaceholder('Untitled code')).toHaveValue('Who is responsible');

	// Away, so the inspector is torn down, and back onto a different code. The
	// pane is clicked near a corner: its middle is where the tree is.
	const pane = document.querySelector('.svelte-flow__pane') as HTMLElement;
	await page.elementLocator(pane).click({ position: { x: 8, y: 8 } });
	await expect.element(page.getByText('Select a code to edit it.')).toBeVisible();

	await page.getByText('What makes acting hard').first().click();

	const name = page.getByPlaceholder('Untitled code');
	await expect.element(name).toHaveValue('What makes acting hard');
	expect(document.activeElement).not.toBe(name.element());
});
