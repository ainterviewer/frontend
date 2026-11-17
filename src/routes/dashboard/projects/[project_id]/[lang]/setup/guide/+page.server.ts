import { error } from '@sveltejs/kit';

import { Projects } from '$lib/api';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, fetch }) => {
	const { project_id, lang } = params;

	const [response, projectRes] = await Promise.all([
		Projects.getLocalizedGuide({
			path: { project_id },
			fetch
		}),
		Projects.getProject({
			path: { project_id },
			fetch
		})
	]);

	// Never fall back to an empty guide: the editor would open blank, and a save
	// would write that blank guide over the real one.
	if (response.error) {
		console.error('Failed to load guide', response.error);
		throw error(500, 'Failed to load the interview guide');
	}
	if (projectRes.error) {
		console.error('Failed to load project', projectRes.error);
		throw error(500, 'Failed to load the project');
	}

	return {
		guide: response.data,
		lang,
		project_id,
		project_name: projectRes.data?.title ?? '',
		available_languages: projectRes.data?.available_languages ?? [],
		external_params: projectRes.data?.external_params ?? []
	};
};
