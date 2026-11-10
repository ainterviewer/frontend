import { describe, expect, it } from 'vitest';

import { describeGridAnswer, encodeGridAnswer, parseGridAnswer } from './grid';

const rows = [
	{ id: 'a', text: 'Cleanliness' },
	{ id: 'b', text: 'Signage' },
	{ id: 'c', text: 'Food' }
];

describe('grid answers', () => {
	it('encodes in row order, leaving blanks out', () => {
		expect(encodeGridAnswer({ b: 'Neutral', a: 'Satisfied', c: '' }, rows)).toBe(
			'{"a":"Satisfied","b":"Neutral"}'
		);
	});

	it('parses back, dropping rows that no longer exist', () => {
		expect(parseGridAnswer('{"a":"Satisfied","x":"Neutral"}', rows)).toEqual({ a: 'Satisfied' });
	});

	it.each(['<|skipquestion|>', '[1]', '', 'null', '{"a": 3}'])(
		'reads %s as no ratings',
		(answer) => {
			expect(parseGridAnswer(answer, rows)).toEqual({});
		}
	);

	it('describes as row and option lines', () => {
		expect(describeGridAnswer('{"a":"Satisfied","b":"Neutral"}', rows)).toBe(
			'Cleanliness: Satisfied\nSignage: Neutral'
		);
		expect(describeGridAnswer('<|skipquestion|>', rows)).toBe('<|skipquestion|>');
	});
});
