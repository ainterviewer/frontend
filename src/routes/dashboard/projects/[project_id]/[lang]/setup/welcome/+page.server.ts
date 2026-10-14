import { error } from '@sveltejs/kit';

import { Projects } from '$lib/api';
import { etagOf } from '$lib/content/revision.svelte';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const { project_id } = params;
	const { cookieHeader } = locals;

	const [welcomeRes, projectRes] = await Promise.all([
		Projects.getLocalizedWelcome({
			path: { project_id },
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
		revision: etagOf(welcomeRes.response),
		available_languages: projectRes.data?.available_languages ?? [],
		project_name: projectRes.data?.title ?? ''
	};
};
