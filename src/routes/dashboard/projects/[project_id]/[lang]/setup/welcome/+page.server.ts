import { error } from '@sveltejs/kit';

import { Projects } from '$lib/api';
import { getContentDoc } from '$lib/collab/contentDoc';
import { loadContentStatus } from '$lib/content/status';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, fetch }) => {
	const { project_id } = params;

	const contentStatus = loadContentStatus(project_id, fetch);
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
		contentStatus: await contentStatus,
		available_languages: projectRes.data?.available_languages ?? [],
		project_name: projectRes.data?.title ?? ''
	};
};
