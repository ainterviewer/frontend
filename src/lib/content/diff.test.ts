import { describe, expect, it } from 'vitest';

import type { LocalizedQuestionSection } from '$lib/api/types.gen';

import {
	type Content,
	diffContent,
	diffProse,
	guideChangeCount,
	mergeOrder,
	movedKeys,
	plainText
} from './diff';

function content(sections: LocalizedQuestionSection[], extra: Partial<Content> = {}): Content {
	return {
		languages: ['EN', 'DA'],
		default_language: 'EN',
		languages_in_progress: [],
		guide: { introduction: { EN: 'Hello' }, question_sections: sections },
		consent: null,
		welcome: null,
		emails: {},
		agent_configs: {},
		prompt_overrides: {},
		...extra
	};
}

const q = (id: string, text: string, extra = {}) => ({
	id,
	main_question: { EN: text },
	...extra
});

describe('mergeOrder', () => {
	it('keeps the order after, with removed keys where they were', () => {
		expect(mergeOrder(['a', 'b', 'c'], ['a', 'c', 'd'])).toEqual(['a', 'b', 'c', 'd']);
		expect(mergeOrder(['x', 'a'], ['a'])).toEqual(['x', 'a']);
	});
});

describe('movedKeys', () => {
	it('does not count shifts from additions and removals as moves', () => {
		expect(movedKeys(['a', 'b', 'c'], ['new', 'a', 'c'])).toEqual(new Set());
	});

	it('finds what was taken out of order', () => {
		expect(movedKeys(['a', 'b', 'c', 'd'], ['a', 'c', 'd', 'b'])).toEqual(new Set(['b']));
	});
});

describe('diffContent', () => {
	it('matches questions by id, so rewording one is a change', () => {
		const before = content([{ id: 's1', questions: [q('q1', 'How are you?'), q('q2', 'Why?')] }]);
		const after = content([
			{ id: 's1', questions: [q('q1', 'How do you feel?'), q('q2', 'Why?')] }
		]);
		const [section] = diffContent(before, after, 'EN').sections;

		expect(section.status).toBe('same');
		expect(section.questions.map((x) => x.status)).toEqual(['changed', 'same']);
		expect(section.questions[0].changes).toContainEqual(
			expect.objectContaining({
				label: 'Question',
				status: 'changed',
				before: 'How are you?',
				after: 'How do you feel?',
				prose: true
			})
		);
	});

	it('shows a removed question where it was, and a moved one where it went', () => {
		const before = content([
			{ id: 's1', questions: [q('q1', 'One'), q('q2', 'Two'), q('q3', 'Three')] },
			{ id: 's2', questions: [] }
		]);
		const after = content([
			{ id: 's1', questions: [q('q1', 'One')] },
			{ id: 's2', questions: [q('q3', 'Three')] }
		]);
		const [s1, s2] = diffContent(before, after, 'EN').sections;

		expect(s1.questions.map((x) => [x.id, x.status])).toEqual([
			['q1', 'same'],
			['q2', 'removed']
		]);
		expect(s2.questions).toEqual([
			expect.objectContaining({ id: 'q3', status: 'same', moved: true, fromSection: 1 })
		]);
	});

	it('reads the chosen language, falling back to the default as respondents get it', () => {
		const before = content([{ id: 's1', questions: [q('q1', 'Hi')] }]);
		const after = content([
			{ id: 's1', questions: [{ id: 'q1', main_question: { EN: 'Hi', DA: 'Hej' } }] }
		]);

		expect(guideChangeCount(diffContent(before, after, 'EN'))).toBe(0);
		const [question] = diffContent(before, after, 'DA').sections[0].questions;
		expect(question.changes[0]).toMatchObject({ before: 'Hi', after: 'Hej' });
	});

	it('labels survey options by position and settings by name', () => {
		const survey = (options: string[]) => ({
			type: 'radio' as const,
			options: options.map((text, i) => ({ id: `o${i}`, text: { EN: text } }))
		});
		const before = content([
			{ id: 's1', questions: [q('q1', 'Pick', { survey_item: survey(['Yes', 'No']) })] }
		]);
		const after = content([
			{
				id: 's1',
				questions: [q('q1', 'Pick', { survey_item: survey(['Yes', 'Nope']), max_probes_n: 2 })]
			}
		]);
		const changes = diffContent(before, after, 'EN')
			.sections[0].questions[0].changes.filter((c) => c.status !== 'same')
			.map((c) => [c.label, c.before, c.after]);

		expect(changes).toEqual([
			['Survey › Option 2', 'No', 'Nope'],
			['Max probes', null, '2']
		]);
	});

	it('covers the parts outside the guide', () => {
		const before = content([], {
			agent_configs: { probing: { model: 'a', temperature: 0.5 } },
			emails: { invite: { subject: { EN: 'Join us' } } }
		});
		const after = content([], {
			languages: ['EN', 'DA', 'DE'],
			languages_in_progress: ['DE'],
			agent_configs: { probing: { model: 'b', temperature: 0.5 } },
			emails: { invite: { subject: { EN: 'Join us!' } } },
			prompt_overrides: { 'probing_agent/system_prompt.jinja': 'Be nice' }
		});
		const diff = diffContent(before, after, 'EN');
		const changed = (changes: typeof diff.agents) =>
			changes.filter((c) => c.status !== 'same').map((c) => c.label);

		expect(changed(diff.agents)).toEqual([
			'Probing › Model',
			'Template override › probing_agent/system_prompt.jinja'
		]);
		expect(changed(diff.emails)).toEqual(['Invitation › Subject']);
		expect(changed(diff.languages)).toEqual(['Languages', 'In progress']);
	});

	it('only says that conditions changed', () => {
		const cond = (value: string) => ({
			conditions: [{ question_id: value }],
			action: 'show'
		});
		const before = content([{ id: 's1', questions: [q('q1', 'A', { conditions: cond('x') })] }]);
		const after = content([{ id: 's1', questions: [q('q1', 'A', { conditions: cond('y') })] }]);
		const change = diffContent(before, after, 'EN').sections[0].questions[0].changes.find(
			(c) => c.label === 'Conditions'
		);

		expect(change).toMatchObject({ status: 'changed', opaque: true });
	});
});

describe('plainText', () => {
	it('reads markup as text', () => {
		expect(plainText('<p>Hi <b>there</b> &amp; you</p><p>Bye</p>')).toBe('Hi there & you\nBye');
	});
});

describe('diffProse', () => {
	const text = (d: ReturnType<typeof diffProse>, kind: string) =>
		d.parts
			.filter((p) => p.kind === 'same' || p.kind === kind)
			.map((p) => p.text)
			.join('');

	it('rebuilds both sides', () => {
		const before = 'Intro line\n\nAsk about phones.\nAsk about travel.';
		const after = 'Intro line\n\nAsk about mobile phones.\nNew line\nAsk about travel.';
		const d = diffProse(before, after);
		expect(text(d, 'removed')).toBe(before);
		expect(text(d, 'added')).toBe(after);
		const rewrite = diffProse('Keep\nOld words here', 'Keep\nTotally different thing\nMore');
		expect(text(rewrite, 'removed')).toBe('Keep\nOld words here');
		expect(text(rewrite, 'added')).toBe('Keep\nTotally different thing\nMore');
		expect(text(d, 'added')).toBe(after);
		expect(d.rewritten).toBe(false);
	});

	it('word-diffs a lightly edited line', () => {
		const d = diffProse('Ask about the phones they bought', 'Ask about the phone they bought');
		expect(d.parts).toEqual([
			{ kind: 'same', text: 'Ask about the ' },
			{ kind: 'removed', text: 'phones' },
			{ kind: 'added', text: 'phone' },
			{ kind: 'same', text: ' they bought' }
		]);
	});

	it('joins edits around a small kept word into one phrase', () => {
		const d = diffProse(
			'In this interview we ask about cars and the trips taken in the last year',
			'In this interview we ask about food and the meals eaten in the last year'
		);
		expect(d.parts).toContainEqual({ kind: 'removed', text: 'cars and the trips taken' });
		expect(d.parts).toContainEqual({ kind: 'added', text: 'food and the meals eaten' });
	});

	it('word-diffs a line with one long edit after a kept start', () => {
		const d = diffProse(
			'Tak for at dele! Vi går nu over til at tale om mad og måltider i dit hverdagsliv.',
			'Tak for at dele! Vi vil nu gerne høre mere om dine madvaner.'
		);
		expect(d.parts).toEqual([
			{ kind: 'same', text: 'Tak for at dele! Vi ' },
			{ kind: 'removed', text: 'går nu over til at tale om mad og måltider i dit hverdagsliv' },
			{ kind: 'added', text: 'vil nu gerne høre mere om dine madvaner' },
			{ kind: 'same', text: '.' }
		]);
		expect(d.rewritten).toBe(false);
	});

	it('shows a rewritten line as old, then new', () => {
		const d = diffProse(
			'Keep this line, which is long enough to count\nWrite about framing, maybe inspired by the below',
			'Keep this line, which is long enough to count\nInterviewet handler om respondentens forbrug og hverdagsliv'
		);
		expect(d.parts).toEqual([
			{ kind: 'same', text: 'Keep this line, which is long enough to count\n' },
			{ kind: 'removed', text: 'Write about framing, maybe inspired by the below', block: true },
			{
				kind: 'added',
				text: 'Interviewet handler om respondentens forbrug og hverdagsliv',
				block: true
			}
		]);
		expect(d.rewritten).toBe(false);
	});

	it('marks a text with almost nothing kept as rewritten', () => {
		const d = diffProse(
			'TODO: Write framing\n---\nThe interview covers criteria for deserving help',
			'Interviewet handler om respondentens forbrug i hverdagen\nVi er særligt interesserede i klima'
		);
		expect(d.rewritten).toBe(true);
	});

	it('does not call an added or emptied text rewritten', () => {
		expect(diffProse('', 'New text')).toEqual({
			parts: [{ kind: 'added', text: 'New text', block: true }],
			rewritten: false
		});
		expect(diffProse('Old text', '').rewritten).toBe(false);
	});
});
