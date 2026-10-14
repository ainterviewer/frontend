import type {
	Conditions,
	InterviewGuide,
	LocalizedInterviewGuide,
	Question as ApiQuestion
} from '$lib/api/types.gen';

import { locateContext, resolveConditionTarget } from './conditions';
import { pick, surveyItemOptions } from './localized';
import { mapToLocal } from './normalize';
import type {
	GuideQuestion,
	GuideSection,
	GuideTop,
	LocalConditionSet,
	RenderedConditionSet,
	RenderedQuestion,
	RenderedSection
} from './types';

// One language's rendering of the editor state: what the PDF export and the
// assistant read. `languages[0]` is the language rendered; untranslated text
// is taken from the rest, in order. Mirrors `LocalizedInterviewGuide.render`
// in the library.

function renderSurveyItem(
	item: GuideQuestion['survey_item'],
	languages: string[]
): RenderedQuestion['survey_item'] {
	if (!item) return null;
	if ('options' in item) {
		return { ...item, options: item.options.map((option) => pick(option.text, languages)) };
	}
	if (item.type === 'slider') {
		return {
			...item,
			min_label: pick(item.min_label, languages) || null,
			max_label: pick(item.max_label, languages) || null
		};
	}
	// Number, date and time items carry no text.
	return item as RenderedQuestion['survey_item'];
}

// A condition naming an option matches that option's text in the language.
function renderConditions(
	conditions: LocalConditionSet | null | undefined,
	sections: GuideSection[],
	questionsMap: Record<string, GuideQuestion[]>,
	languages: string[]
): RenderedConditionSet | null {
	if (!conditions) return null;
	return {
		action: conditions.action,
		conditions: conditions.conditions.map((cond) => {
			const target = resolveConditionTarget(cond.question_context, sections, questionsMap);
			const options = surveyItemOptions(target.question?.survey_item) ?? [];
			return {
				...cond,
				evaluation: cond.evaluation.map(({ option_id, trigger_value, ...rest }) => ({
					...rest,
					trigger_value: option_id
						? pick(options.find((o) => o.id === option_id)?.text, languages)
						: (trigger_value ?? '')
				}))
			};
		})
	};
}

// The same conditions with their targets in the API's shape.
function apiConditions(
	rendered: RenderedConditionSet | null | undefined,
	sections: GuideSection[],
	questionsMap: Record<string, GuideQuestion[]>
): Conditions | null {
	if (!rendered) return null;
	return {
		action: rendered.action,
		conditions: rendered.conditions.map((cond) => ({
			...cond,
			question_context: locateContext(cond.question_context, sections, questionsMap)
		}))
	};
}

function renderQuestion(
	q: GuideQuestion,
	sections: GuideSection[],
	questionsMap: Record<string, GuideQuestion[]>,
	languages: string[]
): RenderedQuestion {
	return {
		...q,
		main_question: pick(q.main_question, languages),
		description: pick(q.description, languages) || null,
		probes: q.probes.map((p) => pick(p, languages)),
		alternative_main_questions: (q.alternative_main_questions ?? []).map((a) => pick(a, languages)),
		survey_item: renderSurveyItem(q.survey_item, languages),
		image: q.image
			? {
					...q.image,
					data: q.image.data ?? null,
					description: pick(q.image.description, languages),
					alt: pick(q.image.alt, languages),
					primer: pick(q.image.primer, languages) || null
				}
			: null,
		conditions: renderConditions(q.conditions, sections, questionsMap, languages)
	};
}

// `sections` and `questions` keep the editor's id-based condition targets, as
// the PDF export reads them; `guide` is the API's `InterviewGuide`.
export function renderLocal(
	top: GuideTop,
	sections: GuideSection[],
	questionsMap: Record<string, GuideQuestion[]>,
	languages: string[]
): {
	guide: InterviewGuide;
	sections: RenderedSection[];
	questions: Record<string, RenderedQuestion[]>;
} {
	const questions: Record<string, RenderedQuestion[]> = {};
	for (const section of sections) {
		questions[section.id] = (questionsMap[section.id] ?? []).map((q) =>
			renderQuestion(q, sections, questionsMap, languages)
		);
	}
	const rendered: RenderedSection[] = sections.map((section) => ({
		...section,
		description: pick(section.description, languages),
		questions: []
	}));

	return {
		guide: {
			framing: pick(top.framing, languages),
			introduction: pick(top.introduction, languages),
			outro: pick(top.outro, languages),
			timed_messages: top.timed_messages.map((tm) => ({
				...tm,
				message: pick(tm.message, languages)
			})),
			ai_generated_sections: top.ai_generated_sections,
			extra_variables: top.extra_variables ?? [],
			question_sections: rendered.map((section) => ({
				...section,
				questions: questions[section.id].map((q): ApiQuestion => ({
					...q,
					conditions: apiConditions(q.conditions, sections, questionsMap)
				}))
			}))
		},
		sections: rendered,
		questions
	};
}

// A saved guide rendered, for the exports on the pages that do not hold the
// guide themselves (consent, welcome).
export function renderSaved(guide: LocalizedInterviewGuide, languages: string[]) {
	const { top, sections, questions } = mapToLocal(guide);
	return renderLocal(top, sections, questions, languages);
}
