import { Default } from '$lib/api/sdk.gen';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies, params, fetch }) => {
	const token = cookies.get('token') || '';
	const { project_id, lang } = params;

	const [modelsRes, agentsRes, promptsRes] = await Promise.all([
		Default.getModels({
			auth: token,
			fetch
		}),
		Default.getInterviewAgents({
			path: { project_id, lang },
			auth: token,
			fetch
		}),
		Default.getPrompts({
			path: { project_id, lang },
			auth: token,
			fetch
		})
	]);

	const models = (modelsRes.data as unknown as string[]) || [];
	let agents = agentsRes.data || {};
	const prompts = promptsRes.data || {};

	// Ensure defaults if fields are missing (matching client-side logic)
	if (!agents.probing) agents.probing = { model: 'gpt-4o', temperature: 0.7 };
	if (!agents.classification) agents.classification = { model: 'gpt-4o', temperature: 0.0 };
	if (!agents.security) agents.security = { model: 'gpt-4o', temperature: 0.0, include: false };
	if (!agents.answering) agents.answering = { model: 'gpt-4o', temperature: 0.7 };

	return {
		models,
		agents,
		prompts
	};
};
