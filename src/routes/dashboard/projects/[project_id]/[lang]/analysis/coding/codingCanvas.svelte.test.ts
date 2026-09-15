// The canvas is laid out by CSS, so the real stylesheet has to be here: without
// it the flow pane collapses to no height and every node lands on top of the
// toolbar, which is a fact about the test, not about the page.
import '/src/app.css';

import { page } from 'vitest/browser';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';
import CodingPage from './+page.svelte';

/**
 * The canvas is the one part of this feature that cannot be checked by reasoning
 * about the codebook: Svelte Flow has to measure a pane, run the layout and draw
 * nodes for any of it to be true. So this renders the real page in a real
 * browser and asserts the seed codebook arrives on screen and answers a click.
 */

/** A dashboard-sized window; the default is a phone, where the inspector alone
 * leaves the canvas 90px wide. */
const DESKTOP = { width: 1280, height: 900 };

test('draws the seed codebook and opens the inspector on a code', async () => {
	await page.viewport(DESKTOP.width, DESKTOP.height);
	render(CodingPage);

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
	render(CodingPage);

	await page.getByText('The interview as a situation').first().click();
	const name = page.getByPlaceholder('Untitled code');
	await expect.element(name).toBeVisible();
	await name.fill('Interview artefacts');

	await expect.element(page.getByText('Interview artefacts').first()).toBeVisible();
});
