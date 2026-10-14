import { createContext } from 'svelte';

// Single source of truth for the editor's local models lives with the guide
// route; re-export so existing `$lib/stores/guideStore.svelte` importers keep
// working while both refer to the same types.
import type {
	GuideQuestion,
	GuideSection,
	GuideTop
} from '../../routes/dashboard/projects/[project_id]/[lang]/setup/guide/types';

export type { GuideQuestion, GuideSection, GuideTop };

export type GuideStore = ReturnType<typeof createGuideStore>;

export const [getGuideStore, setGuideStore] = createContext<GuideStore>();

function emptyTop(): GuideTop {
	return {
		framing: {},
		introduction: {},
		outro: {},
		alt_outro: null,
		timed_messages: [],
		ai_generated_sections: 0,
		extra_variables: []
	};
}

// `lang` is the language whose text the editor is showing and editing;
// `defaultLang` the project's default, whose text stands in (greyed) for
// anything not yet translated. The structure is shared by every language.
// Getters, because the page component outlives a switch of language.
export function createGuideStore(getLang: () => string, getDefaultLang: () => string) {
	let _localSections = $state<GuideSection[]>([]);
	let _localQuestions = $state<Record<string, GuideQuestion[]>>({});
	let _top = $state<GuideTop>(emptyTop());
	// Ids of questions whose conditions failed validation on the last save
	// attempt. Used to draw attention to the offending condition panels.
	let _invalidConditionQuestionIds = $state<string[]>([]);

	return {
		get lang() {
			return getLang();
		},
		get defaultLang() {
			return getDefaultLang();
		},
		// The order text is looked up in: the language being edited, then the
		// default.
		get languages() {
			return [getLang(), getDefaultLang()];
		},
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
		get top() {
			return _top;
		},
		set top(v: GuideTop) {
			_top = v;
		},
		get invalidConditionQuestionIds() {
			return _invalidConditionQuestionIds;
		},
		set invalidConditionQuestionIds(v: string[]) {
			_invalidConditionQuestionIds = v;
		}
	};
}
