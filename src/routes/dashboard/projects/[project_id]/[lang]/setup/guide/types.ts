import type {
	Condition,
	Conditions,
	GeneratedQuestions,
	LocalizedCondition,
	LocalizedConditions,
	LocalizedImage,
	LocalizedQuestion,
	LocalizedQuestionSection,
	LocalizedText,
	LocalizedTimedMessage,
	Question as ApiQuestion,
	QuestionContext,
	QuestionSectionQuestion as QuestionSectionOutput
} from '$lib/api/types.gen';

// The editor holds the guide in its localized form: the structure once, every
// piece of text a `{language: text}` map (`LocalizedText`). A text field edits
// the entry for the language being edited; everything else is shared by every
// language. See ./localized for the helpers, and the backend's CLAUDE.md
// ("Project languages and content") for why.

// While editing, a condition points at its target by the question's id, with
// the section it was last seen in as a lookup hint, rather than by position, so
// reordering keeps a condition aimed at the same target. The position the API
// also carries is re-derived at the boundary (see localizeConditions /
// delocalizeConditions in utils).
export type LocalQuestionContext = Omit<QuestionContext, 'question_index' | 'question_id'> & {
	sectionId: string;
	questionId: string;
};

export type LocalCondition = Omit<LocalizedCondition, 'question_context'> & {
	question_context: LocalQuestionContext;
};

export type LocalConditionSet = Omit<LocalizedConditions, 'conditions'> & {
	conditions: LocalCondition[];
};

// Text fields the editor binds to are always present, never null, so a field
// can bind straight to `text[lang]`; ./utils `mapToLocal` normalizes them.
export type GuideImage = Omit<LocalizedImage, 'description' | 'alt' | 'primer'> & {
	description: LocalizedText;
	alt: LocalizedText;
	primer: LocalizedText;
};

export type GuideQuestion = Omit<
	LocalizedQuestion,
	'id' | 'main_question' | 'description' | 'probes' | 'image' | 'conditions'
> & {
	id: string;
	main_question: LocalizedText;
	description: LocalizedText;
	probes: LocalizedText[];
	image?: GuideImage | null;
	conditions?: LocalConditionSet | null;
};

export type GuideSection = Omit<
	LocalizedQuestionSection,
	'id' | 'description' | 'questions' | 'ai_generated_questions'
> & {
	id: string;
	description: LocalizedText;
	questions: GuideQuestion[];
	// Always normalized to an object in the editor (see normalizeGeneratedQuestions).
	ai_generated_questions: GeneratedQuestions;
};

export type GuideTimedMessage = Omit<LocalizedTimedMessage, 'message'> & {
	message: LocalizedText;
};

// The top-level guide fields the editor binds to; sections and questions live
// in the store's `localSections` / `localQuestions`.
export type GuideTop = {
	framing: LocalizedText;
	introduction: LocalizedText;
	outro: LocalizedText;
	alt_outro?: LocalizedText | null;
	timed_messages: GuideTimedMessage[];
	ai_generated_sections: number;
	extra_variables?: string[];
};

// One language's rendering of the editor state, in the shape the PDF export
// and the assistant read: plain strings, conditions still id-based.
export type RenderedCondition = Omit<Condition, 'question_context'> & {
	question_context: LocalQuestionContext;
};

export type RenderedConditionSet = Omit<Conditions, 'conditions'> & {
	conditions: RenderedCondition[];
};

export type RenderedQuestion = Omit<ApiQuestion, 'conditions'> & {
	id: string;
	conditions?: RenderedConditionSet | null;
};

export type RenderedSection = Omit<
	QuestionSectionOutput,
	'questions' | 'ai_generated_questions'
> & {
	id: string;
	questions: RenderedQuestion[];
	ai_generated_questions: GeneratedQuestions;
};
