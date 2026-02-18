import { Projects } from '$lib/api';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, cookies }) => {
	const { project_id, lang } = params;
	const token = cookies.get('token');

	try {
		const response = await Projects.getGuide({
			path: { project_id, lang },
			headers: {
				Cookie: `token=${token}`
			}
		});

		if (response.error) {
			console.error('Error fetching guide:', response.error);
			return { guide: null };
		}

		return {
			guide: response.data,
			lang,
			project_id
		};
	} catch (error) {
		console.error('Exception fetching guide:', error);
		return { guide: null, lang, project_id };
	}
};
