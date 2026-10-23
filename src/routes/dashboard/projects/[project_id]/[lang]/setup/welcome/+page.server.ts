import { error } from '@sveltejs/kit';

import { Projects } from '$lib/api';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const { project_id } = params;

	const [welcomeRes, projectRes] = await Promise.all([
		Projects.getLocalizedWelcome({
			path: { project_id }
		}),
		Projects.getProject({
			path: { project_id }
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
