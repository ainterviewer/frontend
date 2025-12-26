import { Default, Projects } from '$lib/api';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies, params, fetch }) => {
	const token = cookies.get('token') || '';
	const { project_id, lang } = params;

	const [modelsRes, agentsRes, promptsRes] = await Promise.all([
		Default.getModels({
			auth: token,
			fetch
		}),
		Projects.getInterviewAgents({
			path: { project_id, lang },
			auth: token,
			fetch
		}),
		Projects.getPrompts({
			path: { project_id, lang },
			auth: token,
			fetch
		})
	]);

	const models = (modelsRes.data as unknown as string[]) || [];
	const agents = agentsRes.data || {};
	const prompts = promptsRes.data || {};

	return {
		models,
		agents,
		prompts
	};
};
