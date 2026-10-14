import type {
	ExternalParam,
	GeneratedQuestions,
	LocalizedInterviewGuide,
	LocalizedQuestion,
	LocalizedQuestionSection,
	Question as ApiQuestion
} from '$lib/api/types.gen';

import { delocalizeConditions, localizeConditions } from './conditions';
import { textIn } from './localized';
import type { GuideImage, GuideQuestion, GuideSection, GuideTop } from './types';

// Between the server's localized guide and the editor's state. The editor
// keeps every text field present (an empty `{}` rather than null), so a field
// can bind straight to `text[lang]`.

// The AI-generated-questions config in the shape the editor binds to.
export function normalizeGeneratedQuestions(value: GeneratedQuestions | null | undefined) {
	return {
		n: value?.n ?? 0,
		max_probes_n: value?.max_probes_n ?? null,
		max_probes_time: value?.max_probes_time ?? null
	} satisfies GeneratedQuestions;
}

function normalizeImage(image: LocalizedQuestion['image']): GuideImage | null {
	if (!image) return null;
	return {
		...image,
		description: image.description ?? {},
		alt: image.alt ?? {},
		primer: image.primer ?? {}
	};
}

// Every text in a survey item present: option texts and slider labels.
function normalizeSurveyItem(item: LocalizedQuestion['survey_item']): GuideQuestion['survey_item'] {
	if (!item) return null;
	if ('options' in item) {
		return {
			...item,
			options: item.options.map((o) => ({
				...o,
				id: o.id ?? crypto.randomUUID(),
				text: o.text ?? {}
			}))
		};
	}
	if (item.type === 'slider') {
		return { ...item, min_label: item.min_label ?? {}, max_label: item.max_label ?? {} };
	}
	return item;
}

// A question from the server (or freshly made) in the editor's shape.
// Conditions are resolved separately, once every question is in place.
function normalizeQuestion(q: LocalizedQuestion): GuideQuestion {
	return {
		...q,
		id: q.id ?? crypto.randomUUID(),
		main_question: q.main_question ?? {},
		description: q.description ?? {},
		probes: q.probes ?? [],
		alternative_main_questions: q.alternative_main_questions ?? [],
		image: normalizeImage(q.image),
		survey_item: normalizeSurveyItem(q.survey_item),
		conditions: null,
		max_probes_n: q.max_probes_n === undefined ? 3 : q.max_probes_n,
		max_probes_time: q.max_probes_time ?? null,
		can_answer: q.can_answer ?? true,
		can_skip: q.can_skip ?? true,
		check_if_answered: q.check_if_answered ?? false,
		check_if_exhausted: q.check_if_exhausted ?? false,
		create_segue: q.create_segue ?? false,
		exclude_from_history: q.exclude_from_history ?? false,
		user_image: q.user_image ?? false,
		shuffle: q.shuffle ?? false
	};
}

export function newQuestion(): GuideQuestion {
	return normalizeQuestion({});
}

export function newSection(): GuideSection {
	return {
		id: crypto.randomUUID(),
		description: {},
		questions: [],
		shuffle: false,
		ai_generated_questions: normalizeGeneratedQuestions(null)
	};
}

// Adds sections from the server to the editor state, resolving the conditions
// of their questions against everything already there.
export function addLocalSections(
	apiSections: LocalizedQuestionSection[],
	sections: GuideSection[],
	questions: Record<string, GuideQuestion[]>
) {
	const added = apiSections.map((section) => {
		const local: GuideSection = {
			...section,
			id: section.id ?? crypto.randomUUID(),
			description: section.description ?? {},
			questions: [], // Not used in localSections state directly for rendering questions
			ai_generated_questions: normalizeGeneratedQuestions(section.ai_generated_questions)
		};
		sections.push(local);
		questions[local.id] = (section.questions ?? []).map(normalizeQuestion);
		return { local, api: section };
	});

	// Second pass: now that every section/question is in place, find the
	// section each condition's target sits in.
	for (const { local, api } of added) {
		(api.questions ?? []).forEach((q, qIdx) => {
			questions[local.id][qIdx].conditions = localizeConditions(q.conditions, sections, questions);
		});
	}
}

// A question from the server in the editor's shape, with its conditions
// resolved against the current state.
export function localQuestion(
	q: LocalizedQuestion,
	sections: GuideSection[],
	questions: Record<string, GuideQuestion[]>
): GuideQuestion {
	return {
		...normalizeQuestion(q),
		conditions: localizeConditions(q.conditions, sections, questions)
	};
}

export function mapToLocal(data: LocalizedInterviewGuide): {
	top: GuideTop;
	sections: GuideSection[];
	questions: Record<string, GuideQuestion[]>;
} {
	const sections: GuideSection[] = [];
	const questions: Record<string, GuideQuestion[]> = {};
	addLocalSections(data.question_sections ?? [], sections, questions);

	return {
		top: {
			framing: data.framing ?? {},
			introduction: data.introduction ?? {},
			outro: data.outro ?? {},
			alt_outro: data.alt_outro ?? null,
			timed_messages: (data.timed_messages ?? []).map((tm) => ({
				...tm,
				message: tm.message ?? {}
			})),
			ai_generated_sections: data.ai_generated_sections ?? 0,
			extra_variables: data.extra_variables ?? []
		},
		sections,
		questions
	};
}

export function mapFromLocal(
	sections: GuideSection[],
	questionsMap: Record<string, GuideQuestion[]>
): LocalizedQuestionSection[] {
	return sections.map((section) => {
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { questions, ...rest } = section;
		const sectionQuestions = questionsMap[section.id] || [];
		return {
			...rest,
			questions: sectionQuestions.map((q) => {
				const { conditions, ...qRest } = q;
				return {
					...qRest,
					conditions: delocalizeConditions(conditions, sections, questionsMap)
				};
			})
		};
	});
}

// The editor state as the server stores it.
export function localGuide(
	top: GuideTop,
	sections: GuideSection[],
	questionsMap: Record<string, GuideQuestion[]>,
	externalParams: ExternalParam[] = []
): LocalizedInterviewGuide {
	return {
		...top,
		question_sections: mapFromLocal(sections, questionsMap),
		extra_variables: externalParams.map((p) => p.name)
	};
}

// A question in one language's rendering -- from the assistant, which writes in
// the language being edited -- in the editor's localized shape.
export function localizeRenderedQuestion(
	q: Partial<ApiQuestion> & { id?: string | null },
	language: string
): GuideQuestion {
	const survey = q.survey_item;
	let survey_item: GuideQuestion['survey_item'] = null;
	if (survey && 'options' in survey) {
		survey_item = {
			...survey,
			options: survey.options.map((o) => ({ id: crypto.randomUUID(), text: textIn(language, o) }))
		};
	} else if (survey?.type === 'slider') {
		survey_item = {
			...survey,
			min_label: textIn(language, survey.min_label),
			max_label: textIn(language, survey.max_label)
		};
	} else if (survey) {
		// Number, date and time items carry no text.
		survey_item = survey as GuideQuestion['survey_item'];
	}
	const image = q.image
		? {
				...q.image,
				description: textIn(language, q.image.description),
				alt: textIn(language, q.image.alt),
				primer: textIn(language, q.image.primer)
			}
		: null;
	return normalizeQuestion({
		...q,
		id: q.id ?? undefined,
		main_question: textIn(language, q.main_question),
		description: textIn(language, q.description),
		probes: (q.probes ?? []).map((p) => textIn(language, p)),
		alternative_main_questions: (q.alternative_main_questions ?? []).map((a) =>
			textIn(language, a)
		),
		survey_item,
		image,
		// The assistant has no ids to point a condition at.
		conditions: null
	});
}
