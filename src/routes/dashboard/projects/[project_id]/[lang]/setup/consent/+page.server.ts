import { Projects } from '$lib/api';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, request }) => {
	const { project_id, lang } = params;
	const cookieHeader = request.headers.get('cookie');

	const { data, error: fetchError } = await Projects.getConsent({
		path: { project_id, language: lang },
		headers: {
			cookie: cookieHeader || ''
		}
	});

	if (fetchError) {
		console.error('Failed to load consent', fetchError);
		throw error(500, 'Failed to load consent settings');
	}

	return {
		consent: data
	};
};
