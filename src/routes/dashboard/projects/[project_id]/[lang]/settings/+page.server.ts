import { Projects } from '$lib/api';
import type { ProjectPublic } from '$lib/api/types.gen';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies, params }) => {
	const token = cookies.get('token') || '';
	const { project_id } = params;

	const [projectRes] = await Promise.all([
		Projects.getProject({
			auth: token,
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
