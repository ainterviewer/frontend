import { Default, Projects, Synthesize } from '$lib/api';
import type { ProjectPublic } from '$lib/api/types.gen';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ request, params, fetch }) => {
	const cookieHeader = request.headers.get('cookie');
	const { project_id, test_id, lang } = params;

	const [modelsRes, languagesRes, testsResponse, projectRes] = await Promise.all([
		Default.getModels({
			headers: { cookie: cookieHeader },
			fetch
		}),
		Default.getLanguages({
			headers: { cookie: cookieHeader },
			fetch
		}),
		Synthesize.getTestSetups({
			path: { project_id },
			headers: { cookie: cookieHeader },
			fetch
		}),
		Projects.getProject({
			headers: { cookie: cookieHeader },
			path: { project_id: project_id },
			fetch
		})
	]);

	const project: ProjectPublic | undefined = projectRes.data;

	if (!project) {
		error(404, 'Project not found');
	}

	const models = (modelsRes.data as unknown as string[]) || [];
	const languages = (languagesRes.data as unknown as Array<{ code: string; name: string }>) || [];

	const test = testsResponse.data?.find((t) => t.id === test_id);

	if (!test) {
		throw error(404, 'Test not found');
	}

	return {
		models,
		languages,
		test,
		project
	};
};
