import { error } from '@sveltejs/kit';

import { Projects } from '$lib/api';
import { getContentDoc } from '$lib/collab/contentDoc';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, fetch }) => {
	const { project_id, lang } = params;

	const [response, projectRes] = await Promise.all([
		// The shared doc, not the saved guide: that is the last valid doc, and
		// the page would flash it before the doc synced over it.
		getContentDoc(project_id, 'guide', fetch),
		Projects.getProject({
			path: { project_id },
			fetch
		})
	]);

	// Never fall back to an empty guide: the editor would open blank, and a save
	// would write that blank guide over the real one.
	if (response.error || !response.data) {
		console.error('Failed to load guide', response.error);
		throw error(500, 'Failed to load the interview guide');
	}
	if (projectRes.error) {
		console.error('Failed to load project', projectRes.error);
		throw error(500, 'Failed to load the project');
	}

	return {
		guide: response.data,
		docErrors: response.errors,
		lang,
		project_id,
		project_name: projectRes.data?.title ?? '',
		available_languages: projectRes.data?.available_languages ?? [],
		external_params: projectRes.data?.external_params ?? []
	};
};
