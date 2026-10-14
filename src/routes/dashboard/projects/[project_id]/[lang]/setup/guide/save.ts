import { Projects } from '$lib/api';
import type { ExternalParam, LocalizedInterviewGuide } from '$lib/api/types.gen';

import { validateGuideConditions } from './conditions';
import { surveyItemOptions, trimmed } from './localized';
import { localGuide } from './normalize';
import type { GuideQuestion, GuideSection, GuideTop } from './types';

export type SaveGuideResult =
	| { status: 'success' }
	| { status: 'error'; error: unknown }
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

	const { error } = await Projects.updateGuide({
		path: { project_id: projectId },
		body: trimOptions(localGuide(top, sections, questions, externalParams))
	});
	return error ? { status: 'error', error } : { status: 'success' };
}
