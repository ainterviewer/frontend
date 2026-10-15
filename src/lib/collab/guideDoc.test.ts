import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import type { LocalizedInterviewGuide } from '$lib/api/types.gen';

import { align, applyGuide, orderKeys, readGuide, roots } from './guideDoc';

// The browser's half of the guide doc. The backend's tests
// (tests/test_guide_doc.py) pin the same behaviour from the other side, and
// both were checked against each other on every guide in a copy of the
// production database.

const SECTION = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const Q1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const Q2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const Q3 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

function guide(): LocalizedInterviewGuide {
	return {
		framing: { EN: 'Framing' },
		introduction: { EN: 'Hello', DA: 'Hej' },
		extra_variables: [],
		ai_generated_sections: 0,
		question_sections: [
			{
				id: SECTION,
				description: { EN: 'One' },
				shuffle: false,
				questions: [
					{
						id: Q1,
						main_question: { EN: 'How often?' },
						max_probes_n: 2,
						probes: [{ EN: 'More?' }],
						survey_item: {
							type: 'slider',
							min: 0,
							max: 10,
							min_label: { EN: 'Low' },
							max_label: { EN: 'High' }
						}
					},
					{ id: Q2, main_question: { EN: 'Why?' } }
				]
			},
			{
				id: OTHER,
				description: { EN: 'Two' },
				questions: [{ id: Q3, main_question: { EN: 'And?' } }]
			}
		]
	};
}

function seeded(languages = ['EN', 'DA']) {
	const doc = new Y.Doc();
	applyGuide(doc, guide(), languages);
	return doc;
}

function copy(doc: Y.Doc) {
	const other = new Y.Doc();
	Y.applyUpdate(other, Y.encodeStateAsUpdate(doc));
	return other;
}

function sync(a: Y.Doc, b: Y.Doc) {
	Y.applyUpdate(a, Y.encodeStateAsUpdate(b, Y.encodeStateVector(a)));
	Y.applyUpdate(b, Y.encodeStateAsUpdate(a, Y.encodeStateVector(b)));
}

function text(doc: Y.Doc, question: string, field: string, language: string) {
	const entry = roots(doc).questions.get(question) as Y.Map<Y.Map<Y.Text>>;
	return entry.get(field)!.get(language)!;
}

const questionIds = (g: LocalizedInterviewGuide) =>
	g.question_sections?.map((s) => s.questions?.map((q) => q.id));

describe('guide doc', () => {
	it('reads back what was written', () => {
		const read = readGuide(seeded());
		expect(read.introduction).toEqual({ EN: 'Hello', DA: 'Hej' });
		expect(questionIds(read)).toEqual([[Q1, Q2], [Q3]]);
		const slider = read.question_sections![0].questions![0];
		expect(slider.max_probes_n).toBe(2);
		expect(slider.probes).toEqual([{ EN: 'More?' }]);
		expect(slider.survey_item).toMatchObject({ min: 0, max: 10, min_label: { EN: 'Low' } });
	});

	it('gives every text an empty entry per language, read back as untranslated', () => {
		const doc = seeded(['EN', 'DA', 'DE']);
		expect(text(doc, Q2, 'main_question', 'DE').toString()).toBe('');
		expect(readGuide(doc).question_sections![0].questions![1].main_question).toEqual({
			EN: 'Why?'
		});
	});

	it('writes nothing when nothing changed', () => {
		const doc = seeded();
		const before = Y.encodeStateVector(doc);
		applyGuide(doc, readGuide(doc), ['EN', 'DA']);
		expect(Y.encodeStateVector(doc)).toEqual(before);
	});

	it('merges two people typing in one field', () => {
		const a = seeded();
		const b = copy(a);
		const edited = (doc: Y.Doc, value: string) => {
			const g = readGuide(doc);
			g.question_sections![0].questions![1].main_question = { EN: value };
			applyGuide(doc, g, ['EN', 'DA']);
		};
		edited(a, 'So, why?');
		edited(b, 'Why? Tell me.');
		sync(a, b);
		expect(text(a, Q2, 'main_question', 'EN').toString()).toBe('So, why? Tell me.');
		expect(readGuide(a)).toEqual(readGuide(b));
	});

	it('keeps an edit that races a move', () => {
		const a = seeded();
		const b = copy(a);
		// One moves Q3 to the top of the first section...
		const moved = readGuide(a);
		const [q3] = moved.question_sections![1].questions!.splice(0, 1);
		moved.question_sections![0].questions!.unshift(q3);
		applyGuide(a, moved, ['EN', 'DA']);
		// ...while the other rewords it.
		const edited = readGuide(b);
		edited.question_sections![1].questions![0].main_question = { EN: 'And then?' };
		applyGuide(b, edited, ['EN', 'DA']);
		sync(a, b);

		const merged = readGuide(a);
		expect(questionIds(merged)).toEqual([[Q3, Q1, Q2], []]);
		expect(merged.question_sections![0].questions![0].main_question).toEqual({ EN: 'And then?' });
	});
});

describe('lists', () => {
	function withProbes(probes: Record<string, string>[]): LocalizedInterviewGuide {
		const g = guide();
		g.question_sections![0].questions![0].probes = probes;
		return g;
	}

	function probe(doc: Y.Doc, index: number) {
		const entry = roots(doc).questions.get(Q1) as Y.Map<Y.Array<Y.Map<Y.Text>>>;
		return entry.get('probes')!.get(index).get('EN')!;
	}

	const probes = (doc: Y.Doc) =>
		readGuide(doc).question_sections![0].questions![0].probes!.map((p) => p.EN);

	it('keeps what someone types in a probe when one above it is removed', () => {
		const doc = new Y.Doc();
		applyGuide(doc, withProbes([{ EN: 'More?' }, { EN: 'Else?' }]), ['EN']);
		const other = copy(doc);

		probe(other, 1).insert(0, 'Anything ');
		applyGuide(doc, withProbes([{ EN: 'Else?' }]), ['EN']);
		sync(doc, other);

		expect(probes(doc)).toEqual(['Anything Else?']);
		expect(probes(other)).toEqual(['Anything Else?']);
	});

	it('keeps what someone types in a probe when one is added above it', () => {
		const doc = new Y.Doc();
		applyGuide(doc, withProbes([{ EN: 'More?' }]), ['EN']);
		const other = copy(doc);

		probe(other, 0).insert(0, 'Tell me ');
		applyGuide(doc, withProbes([{ EN: 'First?' }, { EN: 'More?' }]), ['EN']);
		sync(doc, other);

		expect(probes(doc)).toEqual(['First?', 'Tell me More?']);
	});

	it('pairs entries by content and edits a changed one in place', () => {
		expect(align(['a', 'b', 'c'], ['a', 'c!'])).toEqual([0, 2]);
		expect(align(['a', 'b'], ['new', 'a', 'b'])).toEqual([null, 0, 1]);
		expect(align(['one'], ['two'])).toEqual([0]);
		expect(align([], ['x'])).toEqual([null]);
	});
});

describe('orderKeys', () => {
	it('keeps the keys of whatever is still in order', () => {
		// Moving the last of four to the front rewrites only its key.
		const keys = orderKeys(['a1', 'a2', 'a3', 'a0']);
		expect(keys.slice(0, 3)).toEqual(['a1', 'a2', 'a3']);
		expect(keys[3] > 'a3').toBe(true);
		const moved = orderKeys(['a3', 'a0', 'a1', 'a2']);
		expect(moved.slice(1)).toEqual(['a0', 'a1', 'a2']);
		expect(moved[0] < 'a0').toBe(true);
	});

	it('numbers new entries between their neighbours', () => {
		const keys = orderKeys(['a0', null, 'a1', null]);
		expect(keys[0]).toBe('a0');
		expect(keys[2]).toBe('a1');
		expect([...keys].sort()).toEqual(keys);
		expect(new Set(keys).size).toBe(4);
	});
});
