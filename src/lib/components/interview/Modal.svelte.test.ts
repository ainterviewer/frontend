import '/src/app.css';

import { describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { getReportText } from '$lib/respondentText';

import ReportDialog from './ReportDialog.svelte';

// `Modal` through its one caller with a form in it, so there is something to
// focus and something behind the dialog to keep focus out of.
const text = getReportText('en');

async function dialog(onClose = vi.fn()) {
	const screen = await render(ReportDialog, {
		show: true,
		text,
		canSkip: true,
		onSubmit: async () => true,
		onSkip: () => {},
		onClose
	});
	return { screen, onClose };
}

describe('interview modal', () => {
	test('is a modal dialog named by its title', async () => {
		await dialog();
		await expect.element(page.getByRole('dialog', { name: text.title })).toBeVisible();
	});

	test('takes focus when it opens', async () => {
		await dialog();
		const box = page.getByRole('dialog').element();
		await expect.poll(() => box.contains(document.activeElement)).toBe(true);
	});

	test('closes on Escape', async () => {
		const { onClose } = await dialog();
		await userEvent.keyboard('{Escape}');
		await expect.poll(() => onClose.mock.calls.length).toBe(1);
	});

	test('closes on a click outside it, not on one inside', async () => {
		const { onClose } = await dialog();
		await page.viewport(1024, 768);

		await userEvent.click(page.getByText(text.intro));
		expect(onClose).not.toHaveBeenCalled();

		// The backdrop: the corner of the viewport, outside the centred box.
		await userEvent.click(page.getByRole('dialog'), { position: { x: -10, y: -10 } });
		await expect.poll(() => onClose.mock.calls.length).toBe(1);
	});

	test('scrolls its body rather than growing past a short screen', async () => {
		await page.viewport(375, 400);
		await dialog();
		const box = page.getByRole('dialog').element().getBoundingClientRect();
		expect(box.top).toBeGreaterThanOrEqual(0);
		expect(box.bottom).toBeLessThanOrEqual(400);
		await expect.element(page.getByRole('button', { name: 'Close modal' })).toBeInViewport();
	});
});
