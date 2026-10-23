import { error } from '@sveltejs/kit';

import { Projects } from '$lib/api';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const { project_id } = params;

	const projectRes = await Projects.getProject({
		path: { project_id: project_id }
	});

	if (projectRes.error || !projectRes.data) {
		error(404, 'Project not found');
	}

	return {
		project: projectRes.data
	};
};
