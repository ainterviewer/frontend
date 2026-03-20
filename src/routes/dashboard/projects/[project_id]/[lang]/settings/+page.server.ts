import { Projects } from '$lib/api';
import type { ProjectPublic } from '$lib/api/types.gen';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ request, params }) => {
	const cookieHeader = request.headers.get('cookie');
	const { project_id } = params;

	const [projectRes] = await Promise.all([
		Projects.getProject({
			headers: { cookie: cookieHeader },
			path: { project_id: project_id }
		})
	]);

	const project: ProjectPublic | undefined = projectRes.data;

	if (!project) {
		error(404, 'Project not found');
	}

	return {
		project
	};
};
