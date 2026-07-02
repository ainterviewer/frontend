import type { InterviewGuideOutput } from '$lib/api/types.gen';
import { createContext } from 'svelte';
// Single source of truth for the editor's local models lives with the guide
// route; re-export so existing `$lib/stores/guideStore.svelte` importers keep
// working while both refer to the same types.
import type {
	GuideQuestion,
	GuideSection
} from '../../routes/dashboard/projects/[project_id]/[lang]/setup/guide/types';

export type { GuideQuestion, GuideSection };

export type GuideStore = ReturnType<typeof createGuideStore>;

export const [getGuideStore, setGuideStore] = createContext<GuideStore>();

export function createGuideStore() {
	let _localSections = $state<GuideSection[]>([]);
	let _localQuestions = $state<Record<string, GuideQuestion[]>>({});
	let _guide = $state<InterviewGuideOutput | null>(null);
	// Ids of questions whose conditions failed validation on the last save
	// attempt. Used to draw attention to the offending condition panels.
	let _invalidConditionQuestionIds = $state<string[]>([]);

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
		},
		get invalidConditionQuestionIds() {
			return _invalidConditionQuestionIds;
		},
		set invalidConditionQuestionIds(v: string[]) {
			_invalidConditionQuestionIds = v;
		}
	};
}
