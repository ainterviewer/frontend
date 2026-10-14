import { toast } from 'svelte-sonner';

import { Projects } from '$lib/api';
import type {
	Conditions,
	ExternalParam,
	GeneratedQuestions,
	InterviewGuide,
	LocalizedConditionEvaluation,
	LocalizedConditions,
	LocalizedInterviewGuide,
	LocalizedOption,
	LocalizedQuestion,
	LocalizedQuestionSection,
	LocalizedText,
	Question as ApiQuestion,
	QuestionSectionQuestion as QuestionSectionOutput
} from '$lib/api/types.gen';

import { isUntranslated, pick, textIn, trimText } from './localized';
import type {
	GuideImage,
	GuideQuestion,
	GuideSection,
	GuideTop,
	LocalConditionSet,
	RenderedConditionSet,
	RenderedQuestion,
	RenderedSection
} from './types';

export function generateId() {
	return crypto.randomUUID();
}

// Survey items are a discriminated union; only the choice-based variants
// (radio/checkbox/likert) carry an `options` array. Returns it when present.
export function surveyItemOptions(
	item: GuideQuestion['survey_item'] | null | undefined
): LocalizedOption[] | undefined {
	return item && 'options' in item ? item.options : undefined;
}

// Normalize the AI-generated-questions config into the object shape used by the
// editor. Legacy guides may store it as a plain number (the question count) or
// leave it undefined.
export function normalizeGeneratedQuestions(value: unknown): GeneratedQuestions {
	if (typeof value === 'number') {
		return { n: value, max_probes_n: null, max_probes_time: null };
	}
	const v = (value ?? {}) as GeneratedQuestions;
	return {
		n: v.n ?? 0,
		max_probes_n: v.max_probes_n ?? null,
		max_probes_time: v.max_probes_time ?? null
	};
}

// Converts the API's condition targets into the editor's, adding the section
// each target question currently sits in as the lookup hint. A target missing
// from the guide keeps its id but no section, which validation then flags.
// Returns null for questions without conditions.
export function localizeConditions(
	apiConditions: LocalizedConditions | null | undefined,
	sections: GuideSection[],
	questionsMap: Record<string, GuideQuestion[]>
): LocalConditionSet | null {
	if (!apiConditions) return null;
	return {
		action: apiConditions.action,
		conditions: apiConditions.conditions.map((cond) => {
			const { question_context, ...rest } = cond;
			const target = resolveConditionTarget(
				{ sectionId: '', questionId: question_context.question_id },
				sections,
				questionsMap
			);
			return {
				...rest,
				question_context: {
					part: question_context.part,
					sectionId: target.sectionId,
					questionId: question_context.question_id
				}
			};
		})
	};
}

// Resolves an id-based condition target to where it currently lives. The stored
// `sectionId` is only a hint: question ids are unique across the whole guide, so
// a question dragged into a different section is still found by the fallback
// scan and the reference follows it there instead of dangling. Everything that
// reads a target (display, validation, save, export) must go through this, since
// the stored `sectionId` is deliberately left stale rather than mutated.
// A target that no longer exists resolves to -1 / null.
export function resolveConditionTarget<Q extends { id: string }>(
	ctx: { sectionId: string; questionId: string },
	sections: { id: string }[],
	questionsMap: Record<string, Q[]>
): {
	sectionIndex: number;
	questionIndex: number;
	sectionId: string;
	question: Q | null;
} {
	const miss = { sectionIndex: -1, questionIndex: -1, sectionId: '', question: null };
	if (!ctx.questionId) return miss;

	const at = (sectionIndex: number, questionIndex: number, sectionId: string) => ({
		sectionIndex,
		questionIndex,
		sectionId,
		question: questionsMap[sectionId][questionIndex]
	});

	// Fast path: the target is still in the section it was stored under.
	const storedIdx = sections.findIndex((s) => s.id === ctx.sectionId);
	if (storedIdx >= 0) {
		const q = (questionsMap[ctx.sectionId] || []).findIndex(
			(question) => question.id === ctx.questionId
		);
		if (q >= 0) return at(storedIdx, q, ctx.sectionId);
	}

	// The question moved sections (or the stored section is gone) — find it by id.
	for (let s = 0; s < sections.length; s++) {
		const sectionId = sections[s].id;
		const q = (questionsMap[sectionId] || []).findIndex(
			(question) => question.id === ctx.questionId
		);
		if (q >= 0) return at(s, q, sectionId);
	}

	return miss;
}

// An evaluation names an option when its target has a choice item, and holds a
// `trigger_value` otherwise -- a number, a date or a classification
// instruction, shared by every language. Picking another target leaves the
// other field behind, so the one the target does not use is dropped here.
function evaluationFor(
	evaluation: LocalizedConditionEvaluation,
	target: GuideQuestion | null
): LocalizedConditionEvaluation {
	const { option_id, trigger_value, ...rest } = evaluation;
	return surveyItemOptions(target?.survey_item)
		? { ...rest, option_id, trigger_value: null }
		: { ...rest, option_id: null, trigger_value: trigger_value ?? '' };
}

// Inverse of localizeConditions: sends the target's id along with its current
// position. The server derives the position from the id anyway; a missing
// target is blocked earlier by validateGuideConditions on save.
export function delocalizeConditions(
	localConditions: LocalConditionSet | null | undefined,
	sections: GuideSection[],
	questionsMap: Record<string, GuideQuestion[]>
): LocalizedConditions | null {
	if (!localConditions) return null;
	return {
		action: localConditions.action,
		conditions: localConditions.conditions.map((cond) => {
			const { question_context, evaluation, ...rest } = cond;
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const { sectionId, questionId, ...ctxRest } = question_context;
			const target = resolveConditionTarget(question_context, sections, questionsMap);
			return {
				...rest,
				evaluation: evaluation.map((e) => evaluationFor(e, target.question)),
				question_context: {
					...ctxRest,
					question_id: questionId,
					question_index: [target.sectionIndex, target.questionIndex]
				}
			};
		})
	};
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
			options: item.options.map((o) => ({ ...o, id: o.id ?? generateId(), text: o.text ?? {} }))
		};
	}
	if (item.type === 'slider') {
		return { ...item, min_label: item.min_label ?? {}, max_label: item.max_label ?? {} };
	}
	return item;
}

// A question from the server (or freshly made) in the editor's shape: every
// text field present, so a field can bind to `text[lang]`. Conditions are
// resolved separately, once every question is in place.
function normalizeQuestion(q: LocalizedQuestion): GuideQuestion {
	return {
		...q,
		id: q.id ?? generateId(),
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
		id: generateId(),
		description: {},
		questions: [],
		shuffle: false,
		ai_generated_questions: { n: 0, max_probes_n: null, max_probes_time: null }
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
			id: section.id ?? generateId(),
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

// A condition may only reference a question that appears at or before the
// question that owns it. Referencing a later question/section (or a target that
// no longer exists after reordering) is invalid, since that answer isn't
// available yet when the condition is evaluated. Self-reference is allowed.
export function isConditionTargetValid(
	ownSectionIndex: number,
	ownQuestionIndex: number,
	ctx: { sectionId: string; questionId: string },
	sections: GuideSection[],
	questionsMap: Record<string, GuideQuestion[]>
): boolean {
	// Target must still exist somewhere in the guide.
	const { sectionIndex: s, questionIndex: q } = resolveConditionTarget(ctx, sections, questionsMap);
	if (s < 0 || q < 0) return false;
	// No forward references (same question is allowed).
	if (s > ownSectionIndex) return false;
	if (s === ownSectionIndex && q > ownQuestionIndex) return false;
	return true;
}

// A condition on a choice question has to name one of its options. One whose
// option was deleted -- or that never had one picked -- would match nothing.
export function isConditionOptionValid(
	evaluation: LocalizedConditionEvaluation,
	target: GuideQuestion | null
): boolean {
	const options = surveyItemOptions(target?.survey_item);
	if (!options) return true;
	return options.some((option) => option.id === evaluation.option_id);
}

// Collects the ids of questions whose conditions target a future/invalid
// question or section, or a choice option that is gone, so callers can block
// the save and highlight them.
export function validateGuideConditions(
	sections: GuideSection[],
	questionsMap: Record<string, GuideQuestion[]>
): { invalidQuestionIds: string[] } {
	const invalidQuestionIds: string[] = [];
	sections.forEach((section, sIdx) => {
		const questions = questionsMap[section.id] || [];
		questions.forEach((question, qIdx) => {
			const conditions = question.conditions?.conditions;
			if (!conditions) return;
			const hasInvalid = conditions.some((cond) => {
				if (!isConditionTargetValid(sIdx, qIdx, cond.question_context, sections, questionsMap)) {
					return true;
				}
				const target = resolveConditionTarget(cond.question_context, sections, questionsMap);
				return cond.evaluation.some((e) => !isConditionOptionValid(e, target.question));
			});
			if (hasInvalid) invalidQuestionIds.push(question.id);
		});
	});
	return { invalidQuestionIds };
}

// The number of text fields written in another language but not in `language`.
export function countUntranslated(
	top: GuideTop,
	sections: GuideSection[],
	questionsMap: Record<string, GuideQuestion[]>,
	language: string
): number {
	const texts: (LocalizedText | null | undefined)[] = [
		top.framing,
		top.introduction,
		top.outro,
		top.alt_outro,
		...top.timed_messages.map((tm) => tm.message)
	];
	for (const section of sections) {
		texts.push(section.description);
		for (const q of questionsMap[section.id] ?? []) {
			texts.push(q.main_question, q.description, ...q.probes);
			texts.push(...(q.alternative_main_questions ?? []));
			for (const option of surveyItemOptions(q.survey_item) ?? []) texts.push(option.text);
			if (q.survey_item?.type === 'slider') {
				texts.push(q.survey_item.min_label, q.survey_item.max_label);
			}
			if (q.image) texts.push(q.image.description, q.image.alt, q.image.primer);
		}
	}
	return texts.filter((text) => isUntranslated(text, language)).length;
}

// ----- one language's rendering of the editor state ---------------------------

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

// The editor state as `languages[0]` reads it, untranslated text taken from
// the rest in order: plain strings, as the PDF export and the assistant want.
// `guide` is the API's `InterviewGuide`, with conditions in its shape.
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

	const questionSections: QuestionSectionOutput[] = rendered.map((section) => ({
		...section,
		questions: questions[section.id].map((q, qIdx): ApiQuestion => {
			const conditions = questionsMap[section.id][qIdx].conditions;
			const located = delocalizeConditions(conditions, sections, questionsMap);
			return {
				...q,
				conditions: located && q.conditions ? withTriggers(located, q.conditions) : null
			};
		})
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
			question_sections: questionSections
		},
		sections: rendered,
		questions
	};
}

// A saved guide as `languages[0]` reads it, for the exports on the pages that
// do not hold the guide themselves (consent, welcome).
export function renderSaved(guide: LocalizedInterviewGuide, languages: string[]) {
	const { top, sections, questions } = mapToLocal(guide);
	return renderLocal(top, sections, questions, languages);
}

// The API's conditions, positions resolved, with the rendered trigger values.
function withTriggers(located: LocalizedConditions, rendered: RenderedConditionSet): Conditions {
	return {
		action: located.action,
		conditions: located.conditions.map((cond, cIdx) => ({
			...cond,
			evaluation: rendered.conditions[cIdx].evaluation
		}))
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
			options: survey.options.map((o) => ({ id: generateId(), text: textIn(language, o) }))
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
	return {
		...normalizeQuestion({
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
		})
	};
}

export type SaveGuideResult =
	{ status: 'success' } | { status: 'error' } | { status: 'invalid'; invalidQuestionIds: string[] };

function trimSurveyItemOptions(questionsMap: Record<string, GuideQuestion[]>) {
	for (const questions of Object.values(questionsMap)) {
		for (const question of questions) {
			for (const option of surveyItemOptions(question.survey_item) ?? []) {
				if (option.text) trimText(option.text);
			}
		}
	}
}

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

export async function saveGuide(
	projectId: string,
	top: GuideTop,
	localSections: GuideSection[],
	localQuestions: Record<string, GuideQuestion[]>,
	externalParams: ExternalParam[] = []
): Promise<SaveGuideResult> {
	const { invalidQuestionIds } = validateGuideConditions(localSections, localQuestions);
	if (invalidQuestionIds.length > 0) {
		// Let the caller surface the message so it can also highlight the panels.
		return { status: 'invalid', invalidQuestionIds };
	}

	trimSurveyItemOptions(localQuestions);

	const { error } = await Projects.updateGuide({
		path: { project_id: projectId },
		body: localGuide(top, localSections, localQuestions, externalParams)
	});
	if (error) {
		console.error('Failed to save guide', error);
		toast.error('Failed to save guide');
		return { status: 'error' };
	}
	toast.success('Guide saved');
	return { status: 'success' };
}
