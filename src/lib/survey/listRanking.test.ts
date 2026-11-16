import { describe, expect, it } from 'vitest';

import {
	describeListAnswer,
	encodeListAnswer,
	fewestEntries,
	fixedEntries,
	initialEntries,
	parseListAnswer
} from './list';
import {
	describeRankingAnswer,
	encodeRankingAnswer,
	initialOrder,
	moveTo,
	parseRankingAnswer,
	rankedCount
} from './ranking';

const SKIP = '<|skipquestion|>';
const OPTIONS = ['Price', 'Quality', 'Delivery', 'Brand'];

describe('list answer', () => {
	it('is the trimmed entries as JSON, blanks left out', () => {
		expect(JSON.parse(encodeListAnswer([' Slack ', '', 'Figma', '  ']))).toEqual([
			'Slack',
			'Figma'
		]);
	});

	it('round-trips', () => {
		expect(parseListAnswer(encodeListAnswer(['Æble', 'Figma']))).toEqual(['Æble', 'Figma']);
	});

	it.each([SKIP, '{}', '', '['])('reads %j as no entries', (answer) => {
		expect(parseListAnswer(answer)).toEqual([]);
	});

	it('describes as bullet lines, and anything else as is', () => {
		expect(describeListAnswer(encodeListAnswer(['Slack', 'Figma']))).toBe('- Slack\n- Figma');
		expect(describeListAnswer(SKIP)).toBe(SKIP);
	});
});

describe('list bounds', () => {
	it('is fixed when the bounds are equal', () => {
		expect(fixedEntries({ min_entries: 3, max_entries: 3 })).toBe(3);
		expect(fixedEntries({ min_entries: 2, max_entries: 3 })).toBeNull();
		expect(fixedEntries({})).toBeNull();
	});

	it('needs at least one entry to submit, optional or not', () => {
		expect(fewestEntries({})).toBe(1);
		expect(fewestEntries({ required: false })).toBe(1);
		expect(fewestEntries({ min_entries: 2 })).toBe(2);
	});

	it.each([
		[{}, 1],
		[{ min_entries: 3, max_entries: 3 }, 3],
		[{ min_entries: 2, max_entries: 5 }, 2],
		[{ max_entries: 4 }, 1]
	])('starts %j with %i fields', (bounds, n) => {
		expect(initialEntries(bounds)).toBe(n);
	});
});

describe('ranking answer', () => {
	it('ranks every option, or the top N', () => {
		expect(rankedCount(OPTIONS)).toBe(4);
		expect(rankedCount(OPTIONS, 2)).toBe(2);
		expect(rankedCount(OPTIONS, 9)).toBe(4);
	});

	it('is the first `count` options of the order, by text', () => {
		expect(JSON.parse(encodeRankingAnswer(OPTIONS, [3, 0, 1, 2], 2))).toEqual(['Brand', 'Price']);
	});

	it('parses back to positions, dropping unknown and repeated options', () => {
		expect(
			parseRankingAnswer(JSON.stringify(['Brand', 'Colour', 'Brand', 'Price']), OPTIONS)
		).toEqual([3, 0]);
		expect(parseRankingAnswer(SKIP, OPTIONS)).toEqual([]);
	});

	it('describes as numbered lines, and anything else as is', () => {
		expect(describeRankingAnswer(JSON.stringify(['Brand', 'Price']), OPTIONS)).toBe(
			'1. Brand\n2. Price'
		);
		expect(describeRankingAnswer(SKIP, OPTIONS)).toBe(SKIP);
	});

	it('starts in the order shown, a submitted ranking first', () => {
		expect(initialOrder(OPTIONS)).toEqual([0, 1, 2, 3]);
		expect(initialOrder(OPTIONS, [2, 0, 3, 1])).toEqual([2, 0, 3, 1]);
		expect(initialOrder(OPTIONS, [2, 0, 3, 1], JSON.stringify(['Brand', 'Quality']))).toEqual([
			3, 1, 2, 0
		]);
		// An order drawn for other options is not this item's.
		expect(initialOrder(OPTIONS, [1, 0])).toEqual([0, 1, 2, 3]);
	});

	it('moves an entry within bounds only', () => {
		expect(moveTo([0, 1, 2], 2, 0)).toEqual([2, 0, 1]);
		expect(moveTo([0, 1, 2], 0, -1)).toEqual([0, 1, 2]);
		expect(moveTo([0, 1, 2], 2, 3)).toEqual([0, 1, 2]);
	});
});
