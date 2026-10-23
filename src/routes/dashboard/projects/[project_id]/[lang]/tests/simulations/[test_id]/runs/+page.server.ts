import { error } from '@sveltejs/kit';

import { Default, Projects, Synthesize } from '$lib/api';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, fetch }) => {
	const { project_id, test_id } = params;

	const [modelsRes, testsResponse, projectRes] = await Promise.all([
		Default.getModels({
			fetch
		}),
		Synthesize.getTestSetups({
			path: { project_id },
			fetch
		}),
		Projects.getProject({
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

	const models = modelsRes.data ?? [];
	const languages = projectRes.data.available_languages;

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
