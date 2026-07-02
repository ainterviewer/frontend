import { Projects } from '$lib/api';
import type {
	QuestionOutput as ApiQuestion,
	ConditionsOutput,
	ExternalParam,
	GeneratedQuestions,
	InterviewGuideInput,
	InterviewGuideOutput,
	QuestionSectionQuestionOutput as QuestionSectionOutput
} from '$lib/api/types.gen';
import { toast } from 'svelte-sonner';
import type { GuideQuestion, GuideSection, LocalConditionSet } from './types';

export function generateId() {
	return crypto.randomUUID();
}

// Survey items are a discriminated union; only the choice-based variants
// (radio/checkbox/likert) carry an `options` array. Returns it when present.
export function surveyItemOptions(
	item: NonNullable<GuideQuestion['survey_item']> | null | undefined
): string[] | undefined {
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

// Converts the API's index-based condition targets into the editor's id-based
// targets, resolving each index against the given (already id-bearing) local
// sections/questions. Unresolvable targets keep an empty id, which validation
// then flags. Returns null for questions without conditions.
export function localizeConditions(
	apiConditions: ConditionsOutput | null | undefined,
	sections: GuideSection[],
	questionsMap: Record<string, GuideQuestion[]>
): LocalConditionSet | null {
	if (!apiConditions) return null;
	return {
		action: apiConditions.action,
		conditions: apiConditions.conditions.map((cond) => {
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const { question_context, ...rest } = cond;
			const targetSection = sections[question_context.section];
			const targetQuestion = targetSection
				? (questionsMap[targetSection.id] || [])[question_context.question]
				: undefined;
			return {
				...rest,
				question_context: {
					part: question_context.part,
					sectionId: targetSection?.id ?? '',
					questionId: targetQuestion?.id ?? ''
				}
			};
		})
	};
}

// Inverse of localizeConditions: resolves the editor's id-based targets back to
// the current section/question indices for the API. A missing target resolves
// to -1 (blocked earlier by validateGuideConditions on save).
export function delocalizeConditions(
	localConditions: LocalConditionSet | null | undefined,
	sections: GuideSection[],
	questionsMap: Record<string, GuideQuestion[]>
): ConditionsOutput | null {
	if (!localConditions) return null;
	return {
		action: localConditions.action,
		conditions: localConditions.conditions.map((cond) => {
			const { question_context, ...rest } = cond;
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const { sectionId, questionId, ...ctxRest } = question_context;
			const section = sections.findIndex((s) => s.id === sectionId);
			const question = (questionsMap[sectionId] || []).findIndex((q) => q.id === questionId);
			return {
				...rest,
				question_context: { ...ctxRest, section, question }
			};
		})
	};
}

export function mapToLocal(data: InterviewGuideOutput): {
	sections: GuideSection[];
	questions: Record<string, GuideQuestion[]>;
} {
	const sections: GuideSection[] = [];
	const questions: Record<string, GuideQuestion[]> = {};

	(data.question_sections || []).forEach((section) => {
		const sId = generateId();
		sections.push({
			...section,
			id: sId,
			questions: [], // Not used in localSections state directly for rendering questions
			ai_generated_questions: normalizeGeneratedQuestions(section.ai_generated_questions)
		});

		questions[sId] = (section.questions || []).map((q) => ({
			...q,
			id: generateId(),
			alternative_main_questions: q.alternative_main_questions || [],
			image: q.image || null,
			survey_item: q.survey_item || null,
			// Resolved to id-based targets in the second pass below, once every
			// section/question has an id.
			conditions: null,
			can_skip: q.can_skip ?? true,
			check_if_answered: q.check_if_answered ?? false,
			check_if_exhausted: q.check_if_exhausted ?? false,
			create_segue: q.create_segue ?? false,
			exclude_from_history: q.exclude_from_history ?? false,
			user_image: q.user_image ?? false,
			shuffle: q.shuffle ?? false
		}));
	});

	// Second pass: now that ids exist for every section/question, convert each
	// condition's index-based target into an id-based one.
	(data.question_sections || []).forEach((section, sIdx) => {
		(section.questions || []).forEach((q, qIdx) => {
			if (!q.conditions) return;
			questions[sections[sIdx].id][qIdx].conditions = localizeConditions(
				q.conditions,
				sections,
				questions
			);
		});
	});

	return { sections, questions };
}

export function mapFromLocal(
	sections: GuideSection[],
	questionsMap: Record<string, GuideQuestion[]>
): QuestionSectionOutput[] {
	return sections.map((section) => {
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { id, questions, ...rest } = section;
		const sectionQuestions = questionsMap[id] || [];
		return {
			...rest,
			questions: sectionQuestions.map((q) => {
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				const { id: qId, conditions, ...qRest } = q;
				return {
					...qRest,
					conditions: delocalizeConditions(conditions, sections, questionsMap)
				} as ApiQuestion;
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
	// Target must point at an existing section/question.
	const s = sections.findIndex((section) => section.id === ctx.sectionId);
	if (s < 0) return false;
	const q = (questionsMap[ctx.sectionId] || []).findIndex(
		(question) => question.id === ctx.questionId
	);
	if (q < 0) return false;
	// No forward references (same question is allowed).
	if (s > ownSectionIndex) return false;
	if (s === ownSectionIndex && q > ownQuestionIndex) return false;
	return true;
}

// Collects the ids of questions whose conditions target a future/invalid
// question or section, so callers can block the save and highlight them.
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
			const hasInvalid = conditions.some(
				(cond) => !isConditionTargetValid(sIdx, qIdx, cond.question_context, sections, questionsMap)
			);
			if (hasInvalid) invalidQuestionIds.push(question.id);
		});
	});
	return { invalidQuestionIds };
}

export type SaveGuideResult =
	{ status: 'success' } | { status: 'error' } | { status: 'invalid'; invalidQuestionIds: string[] };

function trimSurveyItemOptions(questionsMap: Record<string, GuideQuestion[]>) {
	for (const questions of Object.values(questionsMap)) {
		for (const question of questions) {
			const surveyItem = question.survey_item;
			if (surveyItem && 'options' in surveyItem && surveyItem.options) {
				surveyItem.options = surveyItem.options.map((option: string) => option.trim());
			}
		}
	}
}

export async function saveGuide(
	projectId: string,
	lang: string,
	guide: InterviewGuideOutput,
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

	const payload: InterviewGuideInput = {
		...guide,
		question_sections: mapFromLocal(localSections, localQuestions),
		extra_variables: externalParams.map((p) => p.name)
	};
	const { error } = await Projects.createGuide({
		path: { project_id: projectId, lang: lang },
		body: payload
	});
	if (error) {
		console.error('Failed to save guide', error);
		toast.error('Failed to save guide');
		return { status: 'error' };
	}
	toast.success('Guide saved');
	return { status: 'success' };
}
