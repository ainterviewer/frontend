import { describe, expect, it } from 'vitest';

import { labelWords, likertLayout, likertMinWidth } from './likert';

const range = (n: number) => Array.from({ length: n }, (_, i) => String(i + 1));

describe('likertLayout', () => {
	it('moves the words of a numbered scale under it, splitting the row between the ends', () => {
		const options = range(10);
		options[0] = '1. Slet ikke bekymret';
		options[9] = '10. Meget bekymret';
		expect(likertLayout(options)).toEqual({
			ticks: range(10),
			numbered: true,
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
		expect(likertLayout(worded)).toEqual({ ticks: worded, anchors: [], numbered: false });
		expect(likertLayout(range(5))).toEqual({ ticks: range(5), anchors: [], numbered: true });
		expect(likertLayout(['1. Never', 'Sometimes', '3. Always']).anchors).toEqual([]);
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
		// "Overvejende": 11 letters and a little padding, five times, gaps and the frame.
		expect(likertMinWidth(likertLayout(agree))).toBe(5 * (11 * 6.5 + 8) + 4 * 4 + 32);
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
});
