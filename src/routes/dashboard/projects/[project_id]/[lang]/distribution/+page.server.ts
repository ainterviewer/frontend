import { Projects } from '$lib/api';
import { hasErrorCode } from '$lib/utils/errors';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	// The published languages, not the draft's: those are the ones a link can
	// offer. `not_published` means nothing is published yet, and the link leads
	// nowhere.
	const { data, error } = await Projects.getProjectLanguages({
		headers: { cookie: locals.cookieHeader },
		path: { project_id: params.project_id },
		query: { draft: false }
	});

	return {
		publishedLanguages: data ?? [],
		notPublished: hasErrorCode(error, 'not_published')
	};
};
