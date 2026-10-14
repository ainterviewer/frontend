import { describe, expect, it } from 'vitest';

import type { LocalizedInterviewGuide } from '$lib/api/types.gen';
import { zLocalizedQuestion } from '$lib/api/zod.gen';

import { validateGuideConditions } from './conditions';
import { countUntranslated, isUntranslated, pick, QUESTION_TEXT_FIELDS } from './localized';
import { localGuide, localizeRenderedQuestion, mapToLocal, newQuestion } from './normalize';
import { renderLocal } from './render';

// The editor holds the guide with its text per language; these pin that it
// sends back what it was given, renders one language the way the server does,
// and that a condition on a choice names the option rather than its wording.

const RADIO = 'aaaaaaaa-0000-4000-8000-000000000001';
const GATED = 'aaaaaaaa-0000-4000-8000-000000000002';
const SECTION = 'aaaaaaaa-0000-4000-8000-000000000003';
const NEVER = 'aaaaaaaa-0000-4000-8000-000000000004';
const OFTEN = 'aaaaaaaa-0000-4000-8000-000000000005';

function guide(): LocalizedInterviewGuide {
	return {
		framing: { EN: 'Framing', DA: 'Ramme' },
		introduction: { EN: 'Hello' },
		outro: { EN: 'Bye', DA: 'Farvel' },
		timed_messages: [],
		ai_generated_sections: 0,
		extra_variables: [],
		question_sections: [
			{
				id: SECTION,
				description: { EN: 'Section', DA: 'Afsnit' },
				shuffle: false,
				ai_generated_questions: { n: 0, max_probes_n: null, max_probes_time: null },
				questions: [
					{
						id: RADIO,
						main_question: { EN: 'How often?', DA: 'Hvor ofte?' },
						survey_item: {
							type: 'radio',
							options: [
								{ id: OFTEN, text: { EN: 'Often', DA: 'Ofte' } },
								{ id: NEVER, text: { EN: 'Never', DA: 'Aldrig' } }
							]
						}
					},
					{
						id: GATED,
						main_question: { EN: 'Why?' },
						probes: [{ EN: 'Tell me more', DA: 'Fortæl mere' }],
						conditions: {
							action: 'skip_question',
							conditions: [
								{
									question_context: { question_id: RADIO, question_index: [0, 0], part: 'main' },
									trigger_type: 'match',
									evaluation: [{ option_id: NEVER, comparison_operator: '==' }]
								}
							]
						}
					}
				]
			}
		]
	};
}

describe('text', () => {
	it('picks the first language that has text', () => {
		expect(pick({ EN: 'Hi', DA: '' }, ['DA', 'EN'])).toBe('Hi');
		expect(pick({}, ['DA', 'EN'])).toBe('');
	});

	it('is untranslated only when another language has text', () => {
		expect(isUntranslated({ EN: 'Hi' }, 'DA')).toBe(true);
		expect(isUntranslated({ EN: 'Hi', DA: 'Hej' }, 'DA')).toBe(false);
		expect(isUntranslated({}, 'DA')).toBe(false);
	});
});

describe('mapToLocal / localGuide', () => {
	it('sends back the text of every language', () => {
		const { top, sections, questions } = mapToLocal(guide());
		const sent = localGuide(top, sections, questions);

		const [radio, gated] = sent.question_sections![0].questions!;
		expect(sent.framing).toEqual({ EN: 'Framing', DA: 'Ramme' });
		expect(radio.main_question).toEqual({ EN: 'How often?', DA: 'Hvor ofte?' });
		expect(gated.probes).toEqual([{ EN: 'Tell me more', DA: 'Fortæl mere' }]);
	});

	it('keeps the option a condition names, and its position from the id', () => {
		const { top, sections, questions } = mapToLocal(guide());
		const [, gated] = localGuide(top, sections, questions).question_sections![0].questions!;

		const condition = gated.conditions!.conditions[0];
		expect(condition.question_context).toMatchObject({
			question_id: RADIO,
			question_index: [0, 0]
		});
		expect(condition.evaluation[0]).toMatchObject({ option_id: NEVER, trigger_value: null });
	});

	it('drops the option when the target is no longer a choice', () => {
		const { top, sections, questions } = mapToLocal(guide());
		questions[SECTION][0].survey_item = null;

		const [, gated] = localGuide(top, sections, questions).question_sections![0].questions!;

		expect(gated.conditions!.conditions[0].evaluation[0]).toMatchObject({
			option_id: null,
			trigger_value: ''
		});
	});
});

describe('renderLocal', () => {
	it('renders one language, untranslated text from the next', () => {
		const { top, sections, questions } = mapToLocal(guide());
		const rendered = renderLocal(top, sections, questions, ['DA', 'EN']);

		expect(rendered.guide.introduction).toBe('Hello');
		expect(rendered.guide.outro).toBe('Farvel');
		const [radio, gated] = rendered.questions[SECTION];
		expect(radio.survey_item).toMatchObject({ options: ['Ofte', 'Aldrig'] });
		expect(gated.main_question).toBe('Why?');
	});

	it("writes the option's text in the language into the trigger", () => {
		const { top, sections, questions } = mapToLocal(guide());

		for (const [language, never] of [
			['EN', 'Never'],
			['DA', 'Aldrig']
		]) {
			const { guide: rendered } = renderLocal(top, sections, questions, [language, 'EN']);
			const gated = rendered.question_sections![0].questions![1];
			expect(gated.conditions!.conditions[0].evaluation[0].trigger_value).toBe(never);
			expect(gated.conditions!.conditions[0].question_context.question_id).toBe(RADIO);
		}
	});
});

describe('validateGuideConditions', () => {
	it('flags a condition whose option was deleted', () => {
		const { sections, questions } = mapToLocal(guide());
		const radio = questions[SECTION][0];
		if (radio.survey_item && 'options' in radio.survey_item) {
			radio.survey_item.options.splice(1, 1);
		}

		expect(validateGuideConditions(sections, questions).invalidQuestionIds).toEqual([GATED]);
	});

	it('accepts the guide as loaded', () => {
		const { sections, questions } = mapToLocal(guide());
		expect(validateGuideConditions(sections, questions).invalidQuestionIds).toEqual([]);
	});
});

describe('countUntranslated', () => {
	it('counts the text another language has and this one lacks', () => {
		const { top, sections, questions } = mapToLocal(guide());
		// DA lacks the introduction and the gated question's main question.
		expect(countUntranslated(top, sections, questions, 'DA')).toBe(2);
		expect(countUntranslated(top, sections, questions, 'EN')).toBe(0);
	});
});

describe('localizeRenderedQuestion', () => {
	it("makes the assistant's text the language's, options with ids", () => {
		const q = localizeRenderedQuestion(
			{
				main_question: 'Hvor ofte?',
				probes: ['Hvorfor?'],
				survey_item: { type: 'radio', options: ['Ofte', 'Aldrig'] }
			},
			'DA'
		);

		expect(q.main_question).toEqual({ DA: 'Hvor ofte?' });
		expect(q.probes).toEqual([{ DA: 'Hvorfor?' }]);
		const options = q.survey_item && 'options' in q.survey_item ? q.survey_item.options : [];
		expect(options.map((o) => o.text)).toEqual([{ DA: 'Ofte' }, { DA: 'Aldrig' }]);
		expect(new Set(options.map((o) => o.id)).size).toBe(2);
		expect(q.conditions).toBeNull();
	});
});

describe('the editor knows every question field', () => {
	// Everything on a question that is not text, and so is shared by every
	// language. A field the library adds to `LocalizedQuestion` fails this until
	// it is placed in one list or the other -- and, if it holds text, handled by
	// questionTexts, normalize and render.
	const SHARED_FIELDS = [
		'id',
		'max_probes_n',
		'max_probes_time',
		'can_answer',
		'check_if_answered',
		'check_if_exhausted',
		'can_skip',
		'shuffle',
		'create_segue',
		'exclude_from_history',
		'references',
		'user_image',
		'conditions',
		'probing_context'
	];

	it('is text or shared', () => {
		expect([...QUESTION_TEXT_FIELDS, ...SHARED_FIELDS].sort()).toEqual(
			Object.keys(zLocalizedQuestion.shape).sort()
		);
	});
});

describe('newQuestion / normalize defaults', () => {
	it('probes three times by default', () => {
		expect(newQuestion().max_probes_n).toBe(3);
	});
});
