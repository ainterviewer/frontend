import type {
	Condition,
	Conditions,
	GeneratedQuestions,
	Question as ApiQuestion,
	QuestionContext,
	QuestionSectionQuestion as QuestionSectionOutput
} from '$lib/api/types.gen';

// While editing, a condition points at its target by the question's id, with
// the section it was last seen in as a lookup hint, rather than by position, so
// reordering keeps a condition aimed at the same target. The position the API
// also carries is re-derived at the boundary (see localizeConditions /
// delocalizeConditions in utils).
export type LocalQuestionContext = Omit<QuestionContext, 'question_index' | 'question_id'> & {
	sectionId: string;
	questionId: string;
};

export type LocalCondition = Omit<Condition, 'question_context'> & {
	question_context: LocalQuestionContext;
};

export type LocalConditionSet = Omit<Conditions, 'conditions'> & {
	conditions: LocalCondition[];
};

// Extended types based on legacy functionality
export type GuideQuestion = Omit<ApiQuestion, 'conditions'> & {
	id: string;
	conditions?: LocalConditionSet | null;
};

export type GuideSection = Omit<QuestionSectionOutput, 'questions' | 'ai_generated_questions'> & {
	id: string;
	questions: GuideQuestion[];
	// Always normalized to an object in the editor (see normalizeGeneratedQuestions).
	ai_generated_questions: GeneratedQuestions;
};
