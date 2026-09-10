import { Analysis, Projects } from '$lib/api';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const { project_id, interview_id, lang } = params;
	const { cookieHeader } = locals;

	// Fetch messages, categories and the guide in parallel
	const [messagesRes, categoriesRes, guideRes] = await Promise.all([
		Projects.getInterviewMessages({
			path: {
				project_id,
				interview_id
			},
			headers: {
				cookie: cookieHeader || ''
			}
		}),
		Analysis.getAnalysisCategories({
			path: { project_id },
			headers: {
				cookie: cookieHeader || ''
			}
		}),
		// For the conditions a question was subject to. The transcript already
		// shows a skipped question faded; the guide is what says why it was
		// skipped, and what the questions that *were* asked depended on.
		Projects.getGuide({
			path: { project_id, lang },
			headers: {
				cookie: cookieHeader || ''
			}
		})
	]);

	if (messagesRes.error) {
		console.error('Error fetching interview messages:', messagesRes.error);
		return {
			messages: [],
			categories: [],
			guide: null,
			project_id,
			interview_id,
			lang,
			error: 'Failed to fetch interview messages'
		};
	}

	return {
		messages: messagesRes.data || [],
		categories: categoriesRes.data || [],
		// Optional on purpose: a guide that cannot be read costs the condition
		// notes and nothing else, and a transcript is worth reading without them.
		guide: guideRes.data ?? null,
		project_id,
		interview_id,
		lang,
		error: null
	};
};
