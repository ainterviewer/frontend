import { Projects } from '$lib/api';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const { cookieHeader } = locals;
	const { project_id } = params;

	const projectRes = await Projects.getProject({
		headers: { cookie: cookieHeader },
		path: { project_id: project_id }
	});

	if (projectRes.error || !projectRes.data) {
		error(404, 'Project not found');
	}

	return {
		project: projectRes.data
	};
};
