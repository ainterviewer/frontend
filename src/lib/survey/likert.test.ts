import { describe, expect, it } from 'vitest';

import {
	givesWay,
	gridCardMinWidth,
	gridStatementShare,
	gridTableMinWidth,
	labelWords,
	likertCompactMinWidth,
	likertLayout,
	likertMinWidth
} from './likert';

const range = (n: number) => Array.from({ length: n }, (_, i) => String(i + 1));

describe('likertLayout', () => {
	it('moves the words of a numbered scale under it, splitting the row between the ends', () => {
		const options = range(10);
		options[0] = '1. Slet ikke bekymret';
		options[9] = '10. Meget bekymret';
		expect(likertLayout(options)).toEqual({
			ticks: range(10),
			narrow: true,
			anchors: [
				{ index: 0, text: 'Slet ikke bekymret', from: 0, to: 4, align: 'left' },
				{ index: 9, text: 'Meget bekymret', from: 5, to: 9, align: 'right' }
			]
		});
	});

	it('gives the odd middle column to the left end', () => {
		const { anchors } = likertLayout(['1 Low', '2', '3', '4', '5 High']);
		expect(anchors.map((a) => [a.from, a.to])).toEqual([
			[0, 2],
			[3, 4]
		]);
	});

	it('centres a middle anchor and shares the gaps either side', () => {
		const { anchors } = likertLayout(['1) Bad', '2', '3', '4 - Neutral', '5', '6', '7: Good']);
		expect(anchors).toEqual([
			{ index: 0, text: 'Bad', from: 0, to: 1, align: 'left' },
			{ index: 3, text: 'Neutral', from: 2, to: 4, align: 'center' },
			{ index: 6, text: 'Good', from: 5, to: 6, align: 'right' }
		]);
	});

	it('lets a lone anchor use the whole row', () => {
		expect(likertLayout(['0 = None', '1', '2']).anchors).toEqual([
			{ index: 0, text: 'None', from: 0, to: 2, align: 'left' }
		]);
	});

	it('keeps worded scales, and plain numbers, in their columns', () => {
		const worded = ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'];
		expect(likertLayout(worded)).toEqual({ ticks: worded, anchors: [], narrow: false });
		expect(likertLayout(range(5))).toEqual({ ticks: range(5), anchors: [], narrow: true });
		expect(likertLayout(['1. Never', 'Sometimes', '3. Always']).anchors).toEqual([]);
	});

	it('anchors the worded points of a scale with blank or bare-number points', () => {
		const blank = [
			'Meget uenig',
			...Array(4).fill(''),
			'Hverken/eller',
			...Array(4).fill(''),
			'Meget enig'
		];
		expect(likertLayout(blank)).toEqual({
			ticks: Array(11).fill(''),
			narrow: true,
			anchors: [
				{ index: 0, text: 'Meget uenig', from: 0, to: 2, align: 'left' },
				{ index: 5, text: 'Hverken/eller', from: 3, to: 7, align: 'center' },
				{ index: 10, text: 'Meget enig', from: 8, to: 10, align: 'right' }
			]
		});
		expect(likertLayout(['Disagree', '2', '3', '4', 'Agree'])).toMatchObject({
			ticks: ['', '2', '3', '4', ''],
			anchors: [
				{ index: 0, text: 'Disagree', from: 0, to: 2 },
				{ index: 4, text: 'Agree', from: 3, to: 4 }
			]
		});
	});
});

describe('likertMinWidth', () => {
	const agree = [
		'Meget enig',
		'Overvejende enig',
		'Hverken/eller',
		'Overvejende uenig',
		'Meget uenig'
	];

	it('makes every column as wide as the longest word on the scale', () => {
		// "Overvejende" (73px in the browser) and a little padding, five times,
		// the gaps and the frame.
		const width = likertMinWidth(likertLayout(agree));
		expect((width - 4 * 4 - 32) / 5 - 8).toBeCloseTo(73.7, 0);
	});

	it('lets a label wrap after a slash', () => {
		expect(labelWords('Hverken/eller  vil ikke svare')).toEqual([
			'Hverken/',
			'eller',
			'vil',
			'ikke',
			'svare'
		]);
	});

	it('is too wide for a phone but fits a computer', () => {
		const width = likertMinWidth(likertLayout(agree));
		expect(width).toBeGreaterThan(300);
		expect(width).toBeLessThan(480);
	});

	it('gives a numbered scale narrow columns whatever its words', () => {
		const options = range(10);
		options[0] = '1. Slet ikke bekymret';
		expect(likertMinWidth(likertLayout(options))).toBe(10 * 28 + 9 * 4 + 32);
	});

	it('widens the columns until each anchor fits the columns it spans', () => {
		// The first anchor has two columns, but the second only its own, which
		// has to hold "Overvejende" (73.7px) whole.
		const layout = likertLayout(['Overvejende uenig', '', 'Overvejende enig']);
		expect(layout.anchors.map((a) => [a.from, a.to])).toEqual([
			[0, 1],
			[2, 2]
		]);
		expect(likertMinWidth(layout)).toBeCloseTo(3 * 73.68 + 2 * 4 + 32, 1);
	});

	it('keeps an eleven-point scale with blank points in columns on a computer', () => {
		const blank = ['Meget uenig', ...Array(9).fill(''), 'Overvejende uenig'];
		expect(givesWay(likertMinWidth(likertLayout(blank)), true)).toBe('sm');
	});
});

describe('givesWay', () => {
	it('gives way below the breakpoint whose bubble is too narrow', () => {
		expect(givesWay(280)).toBe('never');
		expect(givesWay(340)).toBe('sm');
		expect(givesWay(420)).toBe('md');
		expect(givesWay(600)).toBe('always');
	});

	it('can give way on phones whatever the width', () => {
		expect(givesWay(280, true)).toBe('sm');
		expect(givesWay(420, true)).toBe('md');
	});

	it('answers for a phone alone in the phone preview', () => {
		expect(givesWay(280, false, true)).toBe('never');
		expect(givesWay(340, false, true)).toBe('always');
		expect(givesWay(280, true, true)).toBe('always');
	});
});

describe('gridTableMinWidth', () => {
	it('keeps a short scale in a table on a computer', () => {
		expect(givesWay(gridTableMinWidth(['Nej', 'Lidt', 'Noget', 'Meget', 'Helt']), true)).toBe('sm');
	});

	it('keeps the table where the headings fit, as narrow letters do', () => {
		const agree = ['Meget uenig', 'uenig', 'hverken/eller', 'enig', 'Meget enig'];
		expect(givesWay(gridTableMinWidth(agree), true)).toBe('md');
	});

	it('gives the statements what the points leave, from 30% to half', () => {
		expect(gridStatementShare(['Nej', 'Lidt', 'Meget'])).toBe(0.5);
		expect(
			gridStatementShare(['Meget uenig', 'uenig', 'hverken/eller', 'enig', 'Meget enig'])
		).toBe(0.3);
	});

	it('gives up the table for an eleven-point scale with long words', () => {
		const options = ['Meget uenig', ...Array(9).fill(''), 'Overvejende uenig'];
		expect(givesWay(gridTableMinWidth(options), true)).toBe('always');
	});
});

describe('gridCardMinWidth', () => {
	it('keeps six points side by side on a phone, a long word hyphenated', () => {
		const options = [
			'Meget uenig',
			'Delvis uenig',
			'Hverken enig eller uenig',
			'Delvis enig',
			'Meget enig',
			'Ved ikke'
		];
		expect(givesWay(gridCardMinWidth(options))).toBe('never');
	});

	it('keeps an eleven-point scale with blank points side by side on a computer', () => {
		// Narrow columns, the words under them as anchors; too many for a phone.
		const options = ['Meget uenig', ...Array(9).fill(''), 'Overvejende uenig'];
		expect(givesWay(gridCardMinWidth(options))).toBe('sm');
	});

	it('stacks eleven worded points', () => {
		const options = Array.from({ length: 11 }, (_, i) => `Overvejende ${i}`);
		expect(givesWay(gridCardMinWidth(options))).toBe('always');
	});
});

describe('likertCompactMinWidth', () => {
	it('fits a phone where a long word may hyphenate', () => {
		const agree = [
			'Meget uenig',
			'Overvejende uenig',
			'Hverken/eller',
			'Overvejende enig',
			'Meget enig'
		];
		const layout = likertLayout(agree);
		expect(givesWay(likertMinWidth(layout))).toBe('md');
		expect(givesWay(likertCompactMinWidth(layout))).toBe('never');
	});

	it('is the whole width for a numbered scale, already narrow', () => {
		const layout = likertLayout(range(10));
		expect(likertCompactMinWidth(layout)).toBe(likertMinWidth(layout));
	});
});
