import { error, redirect } from '@sveltejs/kit';

import { defaultLanguage } from '$lib/utils/languages';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent }) => {
	// Loaded by the dashboard layout; null when that call failed.
	const { project } = await parent();
	const lang = defaultLanguage(project?.available_languages ?? []);
	if (!lang) throw error(500, 'Failed to load the project');
	redirect(302, `/dashboard/projects/${params.project_id}/${lang}/setup/guide`);
};
