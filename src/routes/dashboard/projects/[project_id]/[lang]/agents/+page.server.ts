import { error } from '@sveltejs/kit';

import { Default, Projects } from '$lib/api';
import { etagOf } from '$lib/content/revision.svelte';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, fetch }) => {
	const { project_id } = params;

	const [modelsRes, agentsRes, defaultsRes, securityDefaultsRes] = await Promise.all([
		Default.getModels({
			fetch
		}),
		Projects.getInterviewAgents({
			path: { project_id },
			fetch
		}),
		Projects.getPromptDefaults({
			fetch
		}),
		Projects.getSecurityPolicyDefaults({
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
	if (defaultsRes.error) {
		console.error('Failed to load prompt defaults', defaultsRes.error);
		throw error(500, 'Failed to load prompt defaults');
	}

	if (securityDefaultsRes.error || !securityDefaultsRes.data) {
		console.error('Failed to load security policy defaults', securityDefaultsRes.error);
		throw error(500, 'Failed to load security policy defaults');
	}

	const models = modelsRes.data ?? [];
	const agents = agentsRes.data || {};
	const promptDefaults = defaultsRes.data || {};

	return {
		models,
		agents,
		promptDefaults,
		revision: etagOf(agentsRes.response),
		securityPolicyDefaults: securityDefaultsRes.data
	};
};
