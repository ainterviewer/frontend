import type {
	QuestionOutput as ApiQuestion,
	QuestionSectionQuestionOutput as QuestionSectionOutput
} from '$lib/api/types.gen';

// Extended types based on legacy functionality
export type GuideQuestion = ApiQuestion & {
	id: string;
};

export type GuideSection = Omit<QuestionSectionOutput, 'questions'> & {
	id: string;
	questions: GuideQuestion[];
};
