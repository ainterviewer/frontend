import { Projects } from '$lib/api';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const { project_id } = params;
	const { cookieHeader } = locals;

	const projectRes = await Projects.getProject({
		path: { project_id },
		headers: { cookie: cookieHeader || '' }
	});

	return {
		available_languages: projectRes.data?.available_languages ?? []
	};
};
