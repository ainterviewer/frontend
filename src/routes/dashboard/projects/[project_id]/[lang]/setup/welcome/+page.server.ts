import { Projects } from '$lib/api';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, request }) => {
	const { project_id, lang } = params;
	const cookieHeader = request.headers.get('cookie');

	const [welcomeRes, projectRes] = await Promise.all([
		Projects.getWelcome({
			path: { project_id, language: lang },
			headers: {
				cookie: cookieHeader || ''
			}
		}),
		Projects.getProject({
			path: { project_id },
			headers: {
				cookie: cookieHeader || ''
			}
		})
	]);

	if (welcomeRes.error) {
		console.error('Failed to load welcome', welcomeRes.error);
		throw error(500, 'Failed to load welcome settings');
	}

	return {
		welcome: welcomeRes.data,
		available_languages: projectRes.data?.available_languages ?? [],
		project_name: projectRes.data?.title ?? ''
	};
};
