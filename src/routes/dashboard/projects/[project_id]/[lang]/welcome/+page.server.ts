import { Default } from '$lib/api';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, request }) => {
	const { project_id, lang } = params;
	const cookieHeader = request.headers.get('cookie');

	const { data } = await Default.getWelcome({
		path: { project_id, language: lang },
		headers: {
			cookie: cookieHeader || ''
		}
	});

	return {
		welcome: data
	};
};
