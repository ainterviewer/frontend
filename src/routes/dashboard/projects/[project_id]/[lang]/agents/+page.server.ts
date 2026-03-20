import { Default, Projects } from '$lib/api';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ request, params, fetch }) => {
	const cookieHeader = request.headers.get('cookie');
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

	const models = (modelsRes.data as unknown as string[]) || [];
	const agents = agentsRes.data || {};
	const prompts = promptsRes.data || {};

	return {
		models,
		agents,
		prompts
	};
};
