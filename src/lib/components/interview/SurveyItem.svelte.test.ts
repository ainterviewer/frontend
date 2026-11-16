import '/src/app.css';

import { beforeEach, describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
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

describe('shuffled options', () => {
	const shownLabels = (container: HTMLElement) =>
		Array.from(container.querySelectorAll('label'), (label) => label.textContent?.trim());

	test('show in the order drawn for the interview, "Other" last', async () => {
		const screen = await render(SurveyItem, {
			type: 'radio',
			options: ['a', 'b', 'c'],
			shuffle_options: true,
			option_order: [2, 0, 1],
			with_other: true,
			preview: true
		});
		expect(shownLabels(screen.container)).toEqual(['c', 'a', 'b', 'Other']);
	});

	test('show as authored when no order was drawn', async () => {
		const screen = await render(SurveyItem, {
			type: 'checkbox',
			options: ['a', 'b', 'c'],
			shuffle_options: true,
			preview: true
		});
		expect(shownLabels(screen.container)).toEqual(['a', 'b', 'c']);
	});

	test('a read-only answer is marked wherever its option is shown', async () => {
		const screen = await render(SurveyItem, {
			type: 'checkbox',
			options: ['a', 'b', 'c'],
			option_order: [1, 2, 0],
			answer: 'a, c',
			readonly: true
		});
		expect(shownLabels(screen.container)).toEqual(['b', 'c', 'a']);
		await expect.element(screen.getByRole('checkbox', { name: 'a' })).toBeChecked();
		await expect.element(screen.getByRole('checkbox', { name: 'c' })).toBeChecked();
		await expect.element(screen.getByRole('checkbox', { name: 'b' })).not.toBeChecked();
	});
});

describe('shuffled grid rows', () => {
	const rows = [
		{ id: 'a', text: 'smag' },
		{ id: 'b', text: 'lugt' },
		{ id: 'c', text: 'farve' }
	];
	const shownRows = (container: HTMLElement) =>
		Array.from(container.querySelectorAll('tbody th'), (th) =>
			th.textContent?.replace('*', '').trim()
		);

	beforeEach(async () => {
		await page.viewport(1024, 768);
	});

	test('show in the order drawn for the interview, answered in authored order', async () => {
		let given = '';
		const screen = await render(SurveyItem, {
			type: 'likert_grid',
			rows,
			options: ['Nej', 'Ja'],
			shuffle_rows: true,
			row_order: [2, 0, 1],
			onAnswer: (answer: unknown) => {
				given = answer as string;
			}
		});
		expect(shownRows(screen.container)).toEqual(['farve', 'smag', 'lugt']);
		for (const row of ['farve', 'smag', 'lugt'])
			await screen
				.getByRole('radio', { name: `${row}: Ja` })
				.first()
				.click();
		await screen.getByRole('button').click();
		expect(Object.keys(JSON.parse(given))).toEqual(['a', 'b', 'c']);
	});

	test('show as authored when no order was drawn', async () => {
		const screen = await render(SurveyItem, {
			type: 'likert_grid',
			rows,
			options: ['Nej', 'Ja'],
			shuffle_rows: true,
			preview: true
		});
		expect(shownRows(screen.container)).toEqual(['smag', 'lugt', 'farve']);
	});
});

describe('list', () => {
	async function list(props: Record<string, unknown>) {
		let given = '';
		const screen = await render(SurveyItem, {
			type: 'list',
			onAnswer: (answer: unknown) => {
				given = answer as string;
			},
			...props
		});
		return { screen, given: () => given };
	}

	test('a fixed list shows that many fields and nothing to add or remove', async () => {
		const { screen } = await list({ min_entries: 3, max_entries: 3 });
		await expect.element(screen.getByText('Give 3 answers')).toBeVisible();
		expect(screen.getByRole('textbox').all()).toHaveLength(3);
		await expect
			.element(screen.getByRole('button', { name: 'Add another' }))
			.not.toBeInTheDocument();
		await expect
			.element(screen.getByRole('button', { name: /^Remove/ }).first())
			.not.toBeInTheDocument();
	});

	test('adds fields up to the maximum and submits the filled ones', async () => {
		const { screen, given } = await list({ min_entries: 2, max_entries: 3 });
		expect(screen.getByRole('textbox').all()).toHaveLength(2);
		const submit = screen.getByRole('button', { name: 'Submit answers' });
		await screen.getByRole('textbox', { name: 'Answer 1' }).fill('Slack');
		await expect.element(submit).toBeDisabled();
		await screen.getByRole('button', { name: 'Add another' }).click();
		await expect
			.element(screen.getByRole('button', { name: 'Add another' }))
			.not.toBeInTheDocument();
		await screen.getByRole('textbox', { name: 'Answer 3' }).fill(' Figma ');
		await submit.click();
		expect(JSON.parse(given())).toEqual(['Slack', 'Figma']);
	});

	test('a submitted answer is shown read-only', async () => {
		const { screen } = await list({ readonly: true, answer: JSON.stringify(['Slack', 'Figma']) });
		await expect.element(screen.getByRole('textbox', { name: 'Answer 2' })).toHaveValue('Figma');
		await expect.element(screen.getByRole('textbox', { name: 'Answer 2' })).toBeDisabled();
	});
});

describe('ranking', () => {
	const options = ['Pris', 'Kvalitet', 'Levering'];

	function ranked(container: HTMLElement) {
		return [...container.querySelectorAll('li span.flex-1')].map((el) => el.textContent?.trim());
	}

	async function ranking(props: Record<string, unknown>) {
		let given = '';
		const screen = await render(SurveyItem, {
			type: 'ranking',
			options,
			onAnswer: (answer: unknown) => {
				given = answer as string;
			},
			...props
		});
		return { screen, given: () => given };
	}

	test('starts in the drawn order and submits the order the arrows leave', async () => {
		const { screen, given } = await ranking({ shuffle_options: true, option_order: [2, 0, 1] });
		expect(ranked(screen.container)).toEqual(['Levering', 'Pris', 'Kvalitet']);
		await screen.getByRole('button', { name: 'Move up: Kvalitet' }).click();
		expect(ranked(screen.container)).toEqual(['Levering', 'Kvalitet', 'Pris']);
		await screen.getByRole('button', { name: 'Submit ranking' }).click();
		expect(JSON.parse(given())).toEqual(['Levering', 'Kvalitet', 'Pris']);
	});

	test('an option dragged by its handle moves to where it is dropped', async () => {
		const { screen } = await ranking({});
		const handles = screen.container.querySelectorAll<HTMLElement>('li > span.cursor-grab');
		const rows = screen.container.querySelectorAll<HTMLElement>('li');
		const from = handles[2].getBoundingClientRect();
		const to = rows[0].getBoundingClientRect();
		await userEvent.dragAndDrop(page.elementLocator(handles[2]), page.elementLocator(rows[0]), {
			sourcePosition: { x: from.width / 2, y: from.height / 2 },
			targetPosition: { x: to.width / 2, y: 2 }
		});
		await expect.poll(() => ranked(screen.container)).toEqual(['Levering', 'Pris', 'Kvalitet']);
	});

	test('the options step aside while one is dragged, and Escape puts them back', async () => {
		const { screen } = await ranking({});
		const handle = screen.container.querySelectorAll<HTMLElement>('li > span.cursor-grab')[2];
		const top = screen.container.querySelectorAll<HTMLElement>('li')[0].getBoundingClientRect();
		const start = handle.getBoundingClientRect();
		const at = (x: number, y: number) => ({
			bubbles: true,
			isPrimary: true,
			pointerId: 1,
			button: 0,
			buttons: 1,
			clientX: x,
			clientY: y
		});
		const x = start.left + start.width / 2;
		handle.dispatchEvent(new PointerEvent('pointerdown', at(x, start.top + start.height / 2)));
		for (let y = start.top; y >= top.top; y -= 10) {
			document.dispatchEvent(new PointerEvent('pointermove', at(x, y)));
			await new Promise((resolve) => requestAnimationFrame(resolve));
		}
		// Not dropped yet: the others have already made room.
		await expect.poll(() => ranked(screen.container)[0]).toBe('Levering');
		// The sensor listens for it on the element being dragged.
		handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		await expect.poll(() => ranked(screen.container)).toEqual(['Pris', 'Kvalitet', 'Levering']);
	});

	test('a top-N ranking submits only its first N', async () => {
		const { screen, given } = await ranking({ top_n: 2 });
		await expect.element(screen.getByText('Drag your top 2 to the top')).toBeVisible();
		await expect.element(screen.getByText('Not ranked')).toBeVisible();
		await screen.getByRole('button', { name: 'Move up: Levering' }).click();
		await screen.getByRole('button', { name: 'Submit ranking' }).click();
		expect(JSON.parse(given())).toEqual(['Pris', 'Levering']);
	});

	test('a submitted answer is shown in its order, without controls', async () => {
		const { screen } = await ranking({
			readonly: true,
			answer: JSON.stringify(['Levering', 'Pris'])
		});
		expect(ranked(screen.container)).toEqual(['Levering', 'Pris', 'Kvalitet']);
		await expect.element(screen.getByRole('button').first()).not.toBeInTheDocument();
	});
});
