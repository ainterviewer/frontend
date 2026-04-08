import { Projects } from '$lib/api';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, request, fetch }) => {
	const { project_id, lang } = params;
	const cookieHeader = request.headers.get('cookie');

	const [response, projectRes] = await Promise.all([
		Projects.getGuide({
			path: { project_id, lang },
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
		return { guide: null, lang, project_id, project_name: projectRes.data?.title ?? '', available_languages: projectRes.data?.available_languages ?? [] };
	}

	return {
		guide: response.data,
		lang,
		project_id,
		project_name: projectRes.data?.title ?? '',
		available_languages: projectRes.data?.available_languages ?? []
	};
};
