import { Experiments, Projects, Synthesize, type BackgroundInfoOptionsOutput } from '$lib/api';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, request, fetch }) => {
	const { project_id, test_id, lang } = params;
	const cookieHeader = request.headers.get('cookie');

	try {
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

		const test = testsResponse.data?.find((t) => t.id === test_id);

		if (!test) {
			throw error(404, 'Test not found');
		}

		// Fetch detailed info based on type
		if (test.type === 'fixed_answers') {
			try {
				const answersResponse = await Synthesize.getFixedAnswers({
					headers: { cookie: cookieHeader },
					fetch,
					path: { project_id, test_id }
				});
				if (answersResponse.data) {
					test.fixed_answers = answersResponse.data as string[];
				}
			} catch (e) {
				console.warn('Failed to fetch fixed answers', e);
			}
		} else if (test.type === 'fixed_ai') {
			try {
				const personasResponse = await Synthesize.getFixedPersonas({
					headers: { cookie: cookieHeader },
					fetch,
					path: { project_id, test_id }
				});
				if (personasResponse.data) {
					test.fixed_personas = personasResponse.data as string[];
				}
			} catch (e) {
				console.warn('Failed to fetch fixed personas', e);
			}
		} else if (test.type === 'shuffled_ai') {
			try {
				const bgInfoResponse = await Synthesize.getBackgroundInfo({
					headers: { cookie: cookieHeader },
					fetch,
					path: { project_id, test_id }
				});
				if (bgInfoResponse.data) {
					test.background_info = bgInfoResponse.data as BackgroundInfoOptionsOutput;
				}
			} catch (e) {
				console.warn('Failed to fetch background info', e);
			}
		}

		// Extract questions from the guide
		const questions: string[] = [];
		if (guideResponse.data?.question_sections) {
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
	} catch (e) {
		console.error('Failed to load setup data', e);
		throw error(500, 'Failed to load setup data');
	}
};
