import { Projects } from '$lib/api';
import { loadContentStatus } from '$lib/content/status';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, fetch }) => {
	const { project_id } = params;

	const [projectRes, contentStatus] = await Promise.all([
		Projects.getProject({
			path: { project_id },
			fetch
		}),
		loadContentStatus(project_id, fetch)
	]);

	return {
		available_languages: projectRes.data?.available_languages ?? [],
		contentStatus
	};
};
