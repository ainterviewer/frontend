import { describe, expect, it } from 'vitest';

import { likertLayout } from './likert';

const range = (n: number) => Array.from({ length: n }, (_, i) => String(i + 1));

describe('likertLayout', () => {
	it('moves the words of a numbered scale under it, splitting the row between the ends', () => {
		const options = range(10);
		options[0] = '1. Slet ikke bekymret';
		options[9] = '10. Meget bekymret';
		expect(likertLayout(options)).toEqual({
			ticks: range(10),
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
		expect(likertLayout(worded)).toEqual({ ticks: worded, anchors: [] });
		expect(likertLayout(range(5))).toEqual({ ticks: range(5), anchors: [] });
		expect(likertLayout(['1. Never', 'Sometimes', '3. Always']).anchors).toEqual([]);
	});
});
