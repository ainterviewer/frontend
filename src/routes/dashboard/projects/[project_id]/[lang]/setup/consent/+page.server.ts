import { error } from '@sveltejs/kit';

import { Projects } from '$lib/api';
import { getContentDoc } from '$lib/collab/contentDoc';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, fetch }) => {
	const { project_id } = params;

	const [consentRes, projectRes] = await Promise.all([
		// The shared doc, not the saved consent: that is the last valid doc, and
		// the page would flash it before the doc synced over it.
		getContentDoc(project_id, 'consent', fetch),
		Projects.getProject({
			path: { project_id },
			fetch
		})
	]);

	if (consentRes.error || !consentRes.data) {
		console.error('Failed to load consent', consentRes.error);
		throw error(500, 'Failed to load consent settings');
	}

	return {
		consent: consentRes.data,
		docErrors: consentRes.errors,
		available_languages: projectRes.data?.available_languages ?? [],
		project_name: projectRes.data?.title ?? ''
	};
};
