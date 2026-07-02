import type {
	QuestionOutput as ApiQuestion,
	Condition,
	ConditionsOutput,
	GeneratedQuestions,
	QuestionContext,
	QuestionSectionQuestionOutput as QuestionSectionOutput
} from '$lib/api/types.gen';

// While editing, a condition points at its target section/question by their
// stable local ids rather than by array index, so reordering keeps a condition
// aimed at the same target. Indices are re-derived from these ids at the API
// boundary (see localizeConditions / delocalizeConditions in utils).
export type LocalQuestionContext = Omit<QuestionContext, 'section' | 'question'> & {
	sectionId: string;
	questionId: string;
};

export type LocalCondition = Omit<Condition, 'question_context'> & {
	question_context: LocalQuestionContext;
};

export type LocalConditionSet = Omit<ConditionsOutput, 'conditions'> & {
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
