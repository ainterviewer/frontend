import { error } from '@sveltejs/kit';

import { type BackgroundInfoOptions, Projects, type Question, Synthesize } from '$lib/api';
import { etagOf } from '$lib/content/revision.svelte';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, fetch }) => {
	const { project_id, test_id, lang } = params;

	const [testsResponse, guideResponse] = await Promise.all([
		Synthesize.getTestSetups({
			fetch,
			path: { project_id }
		}),
		Projects.getGuide({
			fetch,
			path: { project_id, lang }
		})
	]);

	if (testsResponse.error) {
		console.error('Failed to load test setups', testsResponse.error);
		throw error(500, 'Failed to load setup data');
	}

	const test = testsResponse.data?.find((t) => t.id === test_id);

	if (!test) {
		throw error(404, 'Test not found');
	}

	// Fetch detailed info based on type, and the setup's revision with it:
	// the page saves against it (`If-Match`).
	let revision: string | null = null;
	if (test.type === 'fixed_answers') {
		const answersResponse = await Synthesize.getFixedAnswers({
			fetch,
			path: { project_id, test_id }
		});
		revision = etagOf(answersResponse.response);
		if (!answersResponse.error && answersResponse.data) {
			test.fixed_answers = answersResponse.data;
		}
	} else if (test.type === 'fixed_ai') {
		const personasResponse = await Synthesize.getFixedPersonas({
			fetch,
			path: { project_id, test_id }
		});
		revision = etagOf(personasResponse.response);
		if (!personasResponse.error && personasResponse.data) {
			test.fixed_personas = personasResponse.data as string[];
		}
	} else if (test.type === 'shuffled_ai') {
		const bgInfoResponse = await Synthesize.getBackgroundInfo({
			fetch,
			path: { project_id, test_id }
		});
		revision = etagOf(bgInfoResponse.response);
		if (!bgInfoResponse.error && bgInfoResponse.data) {
			test.background_info = bgInfoResponse.data as BackgroundInfoOptions;
		}
	}

	// Extract the questions from the guide, kept grouped by section so the setup
	// page can mirror the interview guide's section/question numbering.
	const sections: Array<{
		description: string;
		questions: Array<Pick<Question, 'main_question' | 'can_answer'> & { id: string }>;
	}> = [];
	if (!guideResponse.error && guideResponse.data?.question_sections) {
		for (const section of guideResponse.data.question_sections) {
			sections.push({
				description: section.description,
				questions: (section.questions ?? []).map((q) => ({
					// Always set on a guide the server sends; optional in the type
					// only because the server fills it in by default.
					id: q.id ?? '',
					main_question: q.main_question,
					can_answer: q.can_answer
				}))
			});
		}
	}

	return {
		test,
		sections,
		revision
	};
};
