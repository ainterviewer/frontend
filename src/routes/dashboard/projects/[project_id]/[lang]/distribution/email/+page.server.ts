import { Projects } from '$lib/api';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, fetch }) => {
	const { project_id } = params;

	const projectRes = await Projects.getProject({
		path: { project_id },
		fetch
	});

	return {
		available_languages: projectRes.data?.available_languages ?? []
	};
};
