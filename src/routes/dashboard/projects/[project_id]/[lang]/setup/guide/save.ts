import { Projects } from '$lib/api';
import type { ExternalParam, LocalizedInterviewGuide } from '$lib/api/types.gen';
import { isStale, saveWithRevision } from '$lib/content/revision.svelte';

import { validateGuideConditions } from './conditions';
import { surveyItemOptions, trimmed } from './localized';
import { localGuide } from './normalize';
import type { GuideQuestion, GuideSection, GuideTop } from './types';

export type SaveGuideResult =
	| { status: 'success' }
	| { status: 'error'; error: unknown }
	// Someone else saved first and the user chose not to overwrite; they
	// have been told, and the editor keeps its unsaved state.
	| { status: 'stale' }
	| { status: 'invalid'; invalidQuestionIds: string[] };

// Survey options are compared verbatim when an answer is checked, so stray
// whitespace is dropped from every language's option text before saving.
function trimOptions(guide: LocalizedInterviewGuide): LocalizedInterviewGuide {
	return {
		...guide,
		question_sections: guide.question_sections?.map((section) => ({
			...section,
			questions: section.questions?.map((q) => {
				const options = surveyItemOptions(q.survey_item);
				if (!options || !q.survey_item) return q;
				return {
					...q,
					survey_item: {
						...q.survey_item,
						options: options.map((o) => ({ ...o, text: trimmed(o.text ?? {}) }))
					}
				} as typeof q;
			})
		}))
	};
}

// Validates and saves the editor state. Leaves the editor state untouched and
// the messages to the caller.
export async function saveGuide(
	projectId: string,
	top: GuideTop,
	sections: GuideSection[],
	questions: Record<string, GuideQuestion[]>,
	externalParams: ExternalParam[] = []
): Promise<SaveGuideResult> {
	const { invalidQuestionIds } = validateGuideConditions(sections, questions);
	if (invalidQuestionIds.length > 0) {
		return { status: 'invalid', invalidQuestionIds };
	}

	const body = trimOptions(localGuide(top, sections, questions, externalParams));
	const result = await saveWithRevision(projectId, 'the guide', (headers) =>
		Projects.updateGuide({ path: { project_id: projectId }, body, headers })
	);
	if (isStale(result)) return { status: 'stale' };
	return result.error ? { status: 'error', error: result.error } : { status: 'success' };
}
