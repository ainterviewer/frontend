import { Default, Projects, Synthesize } from '$lib/api';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, fetch }) => {
	const { cookieHeader } = locals;
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

	if (projectRes.error || !projectRes.data) {
		error(404, 'Project not found');
	}

	if (testsResponse.error) {
		console.error('Failed to load test setups', testsResponse.error);
		throw error(500, 'Failed to load test setups');
	}

	const models = (modelsRes.error ? [] : (modelsRes.data as unknown as string[])) || [];
	const languages =
		(languagesRes.error
			? []
			: (languagesRes.data as unknown as Array<{ code: string; name: string }>)) || [];

	const test = testsResponse.data?.find((t) => t.id === test_id);

	if (!test) {
		throw error(404, 'Test not found');
	}

	return {
		models,
		languages,
		test,
		project: projectRes.data
	};
};
