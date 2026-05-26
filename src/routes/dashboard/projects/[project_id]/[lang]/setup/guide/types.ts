import type {
	GeneratedQuestions,
	QuestionOutput as ApiQuestion,
	QuestionSectionQuestionOutput as QuestionSectionOutput
} from '$lib/api/types.gen';

// Extended types based on legacy functionality
export type GuideQuestion = ApiQuestion & {
	id: string;
};

export type GuideSection = Omit<QuestionSectionOutput, 'questions' | 'ai_generated_questions'> & {
	id: string;
	questions: GuideQuestion[];
	// Always normalized to an object in the editor (see normalizeGeneratedQuestions).
	ai_generated_questions: GeneratedQuestions;
};
