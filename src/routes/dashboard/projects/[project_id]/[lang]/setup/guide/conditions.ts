import type {
	LocalizedConditionEvaluation,
	LocalizedConditions,
	QuestionContext
} from '$lib/api/types.gen';

import { surveyItemOptions } from './localized';
import type { GuideQuestion, GuideSection, LocalConditionSet, LocalQuestionContext } from './types';

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

// The editor's target in the API's shape: the question's id with its current
// position. The server derives the position from the id anyway.
export function locateContext<Q extends { id: string }>(
	ctx: LocalQuestionContext,
	sections: { id: string }[],
	questionsMap: Record<string, Q[]>
): QuestionContext {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const { sectionId, questionId, ...rest } = ctx;
	const target = resolveConditionTarget(ctx, sections, questionsMap);
	return {
		...rest,
		question_id: questionId,
		question_index: [target.sectionIndex, target.questionIndex]
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

// Inverse of localizeConditions, for saving. A missing target is blocked
// earlier by validateGuideConditions.
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
			const target = resolveConditionTarget(question_context, sections, questionsMap);
			return {
				...rest,
				evaluation: evaluation.map((e) => evaluationFor(e, target.question)),
				question_context: locateContext(question_context, sections, questionsMap)
			};
		})
	};
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
