import type {
	GeneratedQuestions,
	InterviewGuideOutput,
	QuestionOutput,
	QuestionSectionQuestionOutput
} from '$lib/api/types.gen';
import { createContext } from 'svelte';

export type GuideQuestion = QuestionOutput & { id: string };
export type GuideSection = Omit<
	QuestionSectionQuestionOutput,
	'questions' | 'ai_generated_questions'
> & {
	id: string;
	questions: GuideQuestion[];
	// Always normalized to an object in the editor (see normalizeGeneratedQuestions).
	ai_generated_questions: GeneratedQuestions;
};

export type GuideStore = ReturnType<typeof createGuideStore>;

export const [getGuideStore, setGuideStore] = createContext<GuideStore>();

export function createGuideStore() {
	let _localSections = $state<GuideSection[]>([]);
	let _localQuestions = $state<Record<string, GuideQuestion[]>>({});
	let _guide = $state<InterviewGuideOutput | null>(null);

	return {
		get localSections() {
			return _localSections;
		},
		set localSections(v: GuideSection[]) {
			_localSections = v;
		},
		get localQuestions() {
			return _localQuestions;
		},
		set localQuestions(v: Record<string, GuideQuestion[]>) {
			_localQuestions = v;
		},
		get guide() {
			return _guide;
		},
		set guide(v: InterviewGuideOutput | null) {
			_guide = v;
		}
	};
}
