import { error } from '@sveltejs/kit';

import { Projects } from '$lib/api';
import { getContentDoc } from '$lib/collab/contentDoc';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, fetch }) => {
	const { project_id } = params;

	const [welcomeRes, projectRes] = await Promise.all([
		// The shared doc, not the saved welcome: that is the last valid doc, and
		// the page would flash it before the doc synced over it.
		getContentDoc(project_id, 'welcome', fetch),
		Projects.getProject({
			path: { project_id },
			fetch
		})
	]);

	if (welcomeRes.error || !welcomeRes.data) {
		console.error('Failed to load welcome', welcomeRes.error);
		throw error(500, 'Failed to load welcome settings');
	}

	return {
		welcome: welcomeRes.data,
		docErrors: welcomeRes.errors,
		available_languages: projectRes.data?.available_languages ?? [],
		project_name: projectRes.data?.title ?? ''
	};
};
