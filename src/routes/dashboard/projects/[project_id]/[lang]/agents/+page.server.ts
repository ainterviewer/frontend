import { Default, Projects } from '$lib/api';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, fetch }) => {
	const { cookieHeader } = locals;
	const { project_id, lang } = params;

	const [modelsRes, agentsRes, promptsRes] = await Promise.all([
		Default.getModels({
			headers: { cookie: cookieHeader },
			fetch
		}),
		Projects.getInterviewAgents({
			path: { project_id, lang },
			headers: { cookie: cookieHeader },
			fetch
		}),
		Projects.getPrompts({
			path: { project_id, lang },
			headers: { cookie: cookieHeader },
			fetch
		})
	]);

	if (modelsRes.error) {
		console.error('Failed to load models', modelsRes.error);
		throw error(500, 'Failed to load models');
	}
	if (agentsRes.error) {
		console.error('Failed to load agents', agentsRes.error);
		throw error(500, 'Failed to load agents');
	}
	if (promptsRes.error) {
		console.error('Failed to load prompts', promptsRes.error);
		throw error(500, 'Failed to load prompts');
	}

	const models = (modelsRes.data as unknown as string[]) || [];
	const agents = agentsRes.data || {};
	const prompts = promptsRes.data || {};

	return {
		models,
		agents,
		prompts
	};
};
