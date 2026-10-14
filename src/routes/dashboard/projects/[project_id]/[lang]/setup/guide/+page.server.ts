import { Projects } from '$lib/api';
import { etagOf } from '$lib/content/revision.svelte';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals, fetch }) => {
	const { project_id, lang } = params;
	const { cookieHeader } = locals;

	const [response, projectRes] = await Promise.all([
		Projects.getLocalizedGuide({
			path: { project_id },
			headers: { cookie: cookieHeader },
			fetch
		}),
		Projects.getProject({
			headers: { cookie: cookieHeader },
			path: { project_id },
			fetch
		})
	]);

	if (response.error) {
		console.error('Error fetching guide:', response.error);
		return {
			guide: null,
			revision: null,
			lang,
			project_id,
			project_name: projectRes.data?.title ?? '',
			available_languages: projectRes.data?.available_languages ?? [],
			external_params: projectRes.data?.external_params ?? []
		};
	}

	return {
		guide: response.data,
		revision: etagOf(response.response),
		lang,
		project_id,
		project_name: projectRes.data?.title ?? '',
		available_languages: projectRes.data?.available_languages ?? [],
		external_params: projectRes.data?.external_params ?? []
	};
};
