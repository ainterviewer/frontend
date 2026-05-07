import { Projects } from '$lib/api';
import type {
	QuestionOutput as ApiQuestion,
	ExternalParam,
	InterviewGuideOutput,
	QuestionSectionQuestionOutput as QuestionSectionOutput
} from '$lib/api/types.gen';
import { toast } from 'svelte-sonner';
import type { GuideQuestion, GuideSection } from './types';

export function generateId() {
	return crypto.randomUUID();
}

export function mapToLocal(data: InterviewGuideOutput): {
	sections: GuideSection[];
	questions: Record<string, GuideQuestion[]>;
} {
	const sections: GuideSection[] = [];
	const questions: Record<string, GuideQuestion[]> = {};

	(data.question_sections || []).forEach((section) => {
		const sId = generateId();
		sections.push({
			...section,
			id: sId,
			questions: [] // Not used in localSections state directly for rendering questions
		});

		questions[sId] = (section.questions || []).map((q) => ({
			...q,
			id: generateId(), // This generates a new ID, but maybe we should share it?
			// Wait, q doesn't have an ID from API? It's QuestionOutput.
			// If we generate _id, we should use same for id.
			alternative_main_questions: q.alternative_main_questions || [],
			image: q.image || null,
			survey_item: q.survey_item || null,
			conditions: q.conditions || null,
			can_skip: q.can_skip ?? true,
			check_if_answered: q.check_if_answered ?? false,
			check_if_exhausted: q.check_if_exhausted ?? false,
			create_segue: q.create_segue ?? false,
			exclude_from_history: q.exclude_from_history ?? false,
			user_image: q.user_image ?? false,
			shuffle: q.shuffle ?? false
		}));
	});

	return { sections, questions };
}

export function mapFromLocal(
	sections: GuideSection[],
	questionsMap: Record<string, GuideQuestion[]>
): QuestionSectionOutput[] {
	return sections.map((section) => {
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { id, questions, ...rest } = section;
		const sectionQuestions = questionsMap[id] || [];
		return {
			...rest,
			questions: sectionQuestions.map((q) => {
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				const { id: qId, ...qRest } = q;
				return qRest as ApiQuestion;
			})
		};
	});
}

function trimSurveyItemOptions(questionsMap: Record<string, GuideQuestion[]>) {
	for (const questions of Object.values(questionsMap)) {
		for (const question of questions) {
			if (question.survey_item?.options) {
				question.survey_item.options = question.survey_item.options.map((option) => option.trim());
			}
		}
	}
}

export async function saveGuide(
	projectId: string,
	lang: string,
	guide: any,
	localSections: any,
	localQuestions: any,
	externalParams: ExternalParam[] = []
) {
	trimSurveyItemOptions(localQuestions);

	const payload = {
		...guide,
		question_sections: mapFromLocal(localSections, localQuestions),
		extra_variables: externalParams.map((p) => p.name)
	};
	const { error } = await Projects.createGuide({
		path: { project_id: projectId, lang: lang },
		body: payload as any
	});
	if (error) {
		console.error('Failed to save guide', error);
		toast.error('Failed to save guide');
		return;
	}
	toast.success('Guide saved');
}
