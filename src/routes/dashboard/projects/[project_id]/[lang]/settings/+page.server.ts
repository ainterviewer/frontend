import { Default, Projects } from '$lib/api';
import type { PageServerLoad } from './$types';
import type { ProjectPublic } from '$lib/api/types.gen';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ cookies, params, fetch }) => {
	const token = cookies.get('token') || '';
	const { project_id } = params;

	const [projectRes, languagesRes] = await Promise.all([
		Projects.getProject({
			auth: token,
			path: { project_id: project_id },
			fetch
		}),
		Default.getLanguages({
			auth: token,
			fetch
		})
	]);

	const project: ProjectPublic | undefined = projectRes.data;
	const languages = languagesRes.data || [];

	if (!project) {
		error(404, 'Project not found');
	}

	return {
		project,
		languages
	};
};
