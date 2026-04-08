import { Analysis, Projects } from '$lib/api';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const { project_id, interview_id, lang } = params;
	const { cookieHeader } = locals;

	// Fetch messages and categories in parallel
	const [messagesRes, categoriesRes] = await Promise.all([
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
		})
	]);

	if (messagesRes.error) {
		console.error('Error fetching interview messages:', messagesRes.error);
		return {
			messages: [],
			categories: [],
			project_id,
			interview_id,
			lang,
			error: 'Failed to fetch interview messages'
		};
	}

	return {
		messages: messagesRes.data || [],
		categories: categoriesRes.data || [],
		project_id,
		interview_id,
		lang,
		error: null
	};
};
