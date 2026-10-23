import { error } from '@sveltejs/kit';

import { Projects } from '$lib/api';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const { project_id } = params;

	const [consentRes, projectRes] = await Promise.all([
		Projects.getLocalizedConsent({
			path: { project_id }
		}),
		Projects.getProject({
			path: { project_id }
		})
	]);

	if (consentRes.error) {
		console.error('Failed to load consent', consentRes.error);
		throw error(500, 'Failed to load consent settings');
	}

	return {
		consent: consentRes.data,
		available_languages: projectRes.data?.available_languages ?? [],
		project_name: projectRes.data?.title ?? ''
	};
};
