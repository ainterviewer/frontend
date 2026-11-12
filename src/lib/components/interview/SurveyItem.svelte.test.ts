import '/src/app.css';

import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import SurveyItem from './SurveyItem.svelte';

const WORRY = [
	'1. Slet ikke bekymret',
	...Array.from({ length: 8 }, (_, i) => String(i + 2)),
	'10. Meget bekymret'
];

function likert(options: string[], props: { phone?: boolean } = {}) {
	return render(SurveyItem, {
		type: 'likert',
		ui: 'radio',
		options,
		preview: true,
		...props
	});
}

describe('likert labels', () => {
	beforeEach(async () => {
		await page.viewport(1024, 768);
	});

	test('a numbered scale shows numbers under the radios and its words beneath', async () => {
		const screen = await likert(WORRY);
		const first = screen.getByRole('radio', { name: '1. Slet ikke bekymret' });
		await expect.element(first).toBeInTheDocument();
		await expect.element(screen.getByText('Slet ikke bekymret', { exact: true })).toBeVisible();
		await expect.element(screen.getByText('1', { exact: true })).toBeVisible();

		// A tick drops from the number to its words, which sit by their end.
		const number = screen.getByText('1', { exact: true }).element().getBoundingClientRect();
		const tick = screen.container.querySelector('[data-likert-tick]')!.getBoundingClientRect();
		expect(Math.abs(tick.x + tick.width / 2 - (number.x + number.width / 2))).toBeLessThan(1.5);
		const anchor = screen.getByText('Slet ikke bekymret', { exact: true }).element();
		expect(anchor.getBoundingClientRect().left).toBeLessThan(number.left);
	});

	test('clicking an anchor chooses its option', async () => {
		const screen = await likert(WORRY);
		await screen.getByText('Meget bekymret', { exact: true }).click();
		await expect.element(screen.getByRole('radio', { name: '10. Meget bekymret' })).toBeChecked();
	});

	test('the phone layout stacks the options with their full text', async () => {
		const screen = await likert(WORRY, { phone: true });
		await expect.element(screen.getByText('1. Slet ikke bekymret', { exact: true })).toBeVisible();
		await expect.element(screen.getByText('Slet ikke bekymret', { exact: true })).not.toBeVisible();
	});

	test('a phone screen stacks a long scale on its own', async () => {
		await page.viewport(375, 700);
		const screen = await likert(WORRY);
		await expect.element(screen.getByText('10. Meget bekymret', { exact: true })).toBeVisible();
	});

	test('a short scale keeps its columns on a phone', async () => {
		await page.viewport(375, 700);
		const screen = await likert(['1. Low', '2', '3', '4', '5. High'], { phone: true });
		await expect.element(screen.getByText('High', { exact: true })).toBeVisible();
		await expect.element(screen.getByText('5. High', { exact: true })).not.toBeVisible();
	});
});
