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

	test('the words of a worded scale never run into each other', async () => {
		for (const width of [1024, 375]) {
			await page.viewport(width, 700);
			const screen = await likert([
				'Meget enig',
				'Overvejende enig',
				'Hverken/eller',
				'Overvejende uenig',
				'Meget uenig'
			]);
			const words = [...screen.container.querySelectorAll('label > span')].map((span) =>
				span.getBoundingClientRect()
			);
			for (let i = 1; i < words.length; i++) {
				const [a, b] = [words[i - 1], words[i]];
				expect(b.left >= a.right || b.top >= a.bottom).toBe(true);
			}
			screen.unmount();
		}
	});

	test('a scale whose words fit only a wide window gets compact columns in a narrow one', async () => {
		const agree = [
			'Meget enig',
			'Overvejende enig',
			'Hverken/eller',
			'Overvejende uenig',
			'Meget uenig'
		];
		for (const [width, fontSize] of [
			[1024, '12px'],
			[700, '11px'],
			[375, '11px']
		] as const) {
			await page.viewport(width, 700);
			const screen = await likert(agree);
			const labels = [...screen.container.querySelectorAll('label')];
			const [a, b] = labels.map((label) => label.getBoundingClientRect());
			expect(b.top).toBe(a.top);
			expect(getComputedStyle(labels[0]).fontSize).toBe(fontSize);
			screen.unmount();
		}
	});

	test('a scale too long even for compact columns becomes rows on a phone', async () => {
		await page.viewport(375, 700);
		// Whole words from `md`, compact columns between, rows below `sm`.
		const screen = await likert([
			'Nej',
			'Lidt',
			'Noget',
			'Meget',
			'Helt',
			'Ved ikke',
			'Vil ikke',
			'Andet'
		]);
		const label = screen.container.querySelector('label')!;
		const [a, b] = [...screen.container.querySelectorAll('label')].map((l) =>
			l.getBoundingClientRect()
		);
		expect(b.top).toBeGreaterThanOrEqual(a.bottom);
		// The rows' own size wins over the compact columns' at the same width.
		expect(getComputedStyle(label).paddingLeft).toBe('12px');
		expect(getComputedStyle(label).fontSize).toBe('14px');
	});

	test('a scale worded on a few points of many stays in columns on a computer', async () => {
		const blank = [
			'Meget uenig',
			...Array(4).fill(''),
			'Hverken/eller',
			...Array(4).fill(''),
			'Overvejende uenig'
		];
		const screen = await likert(blank);
		const radios = [...screen.container.querySelectorAll('input[type="radio"]')].map((r) =>
			r.getBoundingClientRect()
		);
		expect(radios[10].top).toBe(radios[0].top);
		// The words hang under their point as anchors, not as rows of their own.
		const anchor = screen.container.querySelector<HTMLElement>('label[for$="-5"]')!;
		await expect.element(anchor).toHaveTextContent('Hverken/eller');
		await expect.element(anchor).toBeVisible();
	});
});

describe('likert grid layout', () => {
	const rows = [
		{ id: 'a', text: 'smag' },
		{ id: 'b', text: 'lugt' }
	];

	async function grid(options: string[], phone = false) {
		return render(SurveyItem, {
			type: 'likert_grid',
			rows,
			options,
			preview: true,
			phone
		});
	}

	/** Whether the first card's first two points sit one above the other. */
	function stacked(container: HTMLElement) {
		const [a, b] = [...container.querySelectorAll('[role="radiogroup"] label')].map((label) =>
			label.getBoundingClientRect()
		);
		return b.top >= a.bottom;
	}

	beforeEach(async () => {
		await page.viewport(1024, 768);
	});

	test('a short scale is a table on a computer and side by side on a phone', async () => {
		const short = ['Nej', 'Lidt', 'Noget', 'Meget', 'Helt'];
		let screen = await grid(short);
		await expect.element(screen.getByRole('table')).toBeVisible();
		screen.unmount();

		screen = await grid(short, true);
		await expect.element(screen.getByRole('table', { includeHidden: true })).not.toBeVisible();
		expect(stacked(screen.container)).toBe(false);
	});

	test('six points stay side by side in a card on a phone', async () => {
		const screen = await grid(
			[
				'Meget uenig',
				'Delvis uenig',
				'Hverken enig eller uenig',
				'Delvis enig',
				'Meget enig',
				'Ved ikke'
			],
			true
		);
		expect(stacked(screen.container)).toBe(false);
	});

	test('a scale worded on a few points stays side by side on a computer, its words under it', async () => {
		const screen = await grid(['Meget uenig', ...Array(9).fill(''), 'Overvejende uenig']);
		await expect.element(screen.getByRole('table', { includeHidden: true })).not.toBeVisible();
		expect(stacked(screen.container)).toBe(false);
		const anchor = screen.container.querySelector<HTMLElement>(
			'label[for$="-r0-10"], label[for$="-0-10"]'
		)!;
		await expect.element(anchor).toHaveTextContent('Overvejende uenig');
		await expect.element(anchor).toBeVisible();
	});

	test('eleven worded points stack each card on a computer, and have no table', async () => {
		const screen = await grid(Array.from({ length: 11 }, (_, i) => `Overvejende ${i}`));
		await expect.element(screen.getByRole('table', { includeHidden: true })).not.toBeVisible();
		expect(stacked(screen.container)).toBe(true);
	});
});

describe('slider', () => {
	test('an untouched slider answers its minimum, not a value outside its range', async () => {
		let given: unknown;
		const screen = await render(SurveyItem, {
			type: 'slider',
			min: 1,
			max: 5,
			step: 1,
			onAnswer: (value: unknown) => (given = value)
		});
		await expect.element(screen.getByRole('status')).toHaveTextContent('1');
		await screen.getByRole('button').click();
		expect(given).toBe('1');
	});
});
