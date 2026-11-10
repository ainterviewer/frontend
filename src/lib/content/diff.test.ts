import { describe, expect, it } from 'vitest';

import type { LocalizedQuestionSection } from '$lib/api/types.gen';

import {
	type Content,
	diffContent,
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
