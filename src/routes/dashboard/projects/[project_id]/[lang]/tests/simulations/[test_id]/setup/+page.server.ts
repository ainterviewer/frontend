import { Experiments, Projects, Synthesize, type BackgroundInfoOptionsOutput } from '$lib/api';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, request, fetch }) => {
	const { project_id, test_id, lang } = params;
	const cookieHeader = request.headers.get('cookie');

	const [testsResponse, guideResponse] = await Promise.all([
		Synthesize.getTestSetups({
			headers: { cookie: cookieHeader },
			fetch,
			path: { project_id }
		}),
		Projects.getGuide({
			headers: { cookie: cookieHeader },
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

	// Fetch detailed info based on type
	if (test.type === 'fixed_answers') {
		const answersResponse = await Synthesize.getFixedAnswers({
			headers: { cookie: cookieHeader },
			fetch,
			path: { project_id, test_id }
		});
		if (!answersResponse.error && answersResponse.data) {
			test.fixed_answers = answersResponse.data as string[];
		}
	} else if (test.type === 'fixed_ai') {
		const personasResponse = await Synthesize.getFixedPersonas({
			headers: { cookie: cookieHeader },
			fetch,
			path: { project_id, test_id }
		});
		if (!personasResponse.error && personasResponse.data) {
			test.fixed_personas = personasResponse.data as string[];
		}
	} else if (test.type === 'shuffled_ai') {
		const bgInfoResponse = await Synthesize.getBackgroundInfo({
			headers: { cookie: cookieHeader },
			fetch,
			path: { project_id, test_id }
		});
		if (!bgInfoResponse.error && bgInfoResponse.data) {
			test.background_info = bgInfoResponse.data as BackgroundInfoOptionsOutput;
		}
	}

	// Extract questions from the guide
	const questions: string[] = [];
	if (!guideResponse.error && guideResponse.data?.question_sections) {
		for (const section of guideResponse.data.question_sections) {
			if (section.questions) {
				for (const q of section.questions) {
					questions.push(q.main_question);
				}
			}
		}
	}

	return {
		test,
		questions
	};
};
