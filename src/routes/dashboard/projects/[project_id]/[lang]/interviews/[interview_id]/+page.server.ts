import { Projects } from '$lib/api';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, request }) => {
	const { project_id, interview_id, lang } = params;
	const cookieHeader = request.headers.get('cookie');

	const { data, error } = await Projects.getInterviewMessages({
		path: {
			project_id,
			interview_id
		},
		headers: {
			cookie: cookieHeader || ''
		}
	});

	if (error) {
		console.error('Error fetching interview messages:', error);
		// Return empty messages or handle error appropriately in UI
		return {
			messages: [],
			project_id,
			interview_id,
			lang,
			error: 'Failed to fetch interview messages'
		};
	}

	return {
		messages: data || [],
		project_id,
		interview_id,
		lang,
		error: null
	};
};
