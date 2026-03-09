import { Projects } from '$lib/api';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, cookies, fetch }) => {
	const { project_id, lang } = params;
	const token = cookies.get('token');

	try {
		const [response, projectRes] = await Promise.all([
			Projects.getGuide({
				path: { project_id, lang },
				auth: token,
				fetch
			}),
			Projects.getProject({
				auth: token,
				path: { project_id },
				fetch
			})
		]);

		if (response.error) {
			console.error('Error fetching guide:', response.error);
			return { guide: null, lang, project_id, project_name: projectRes.data?.title ?? '' };
		}

		return {
			guide: response.data,
			lang,
			project_id,
			project_name: projectRes.data?.title ?? ''
		};
	} catch (error) {
		console.error('Exception fetching guide:', error);
		return { guide: null, lang, project_id, project_name: '' };
	}
};
