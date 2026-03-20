import { Synthesize } from '$lib/api';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, request, fetch }) => {
	const { project_id } = params;
	const cookieHeader = request.headers.get('cookie');

	try {
		const response = await Synthesize.getTestSetups({
			headers: { cookie: cookieHeader },
			fetch,
			path: { project_id }
		});

		return {
			tests: response.data || []
		};
	} catch (e) {
		console.error('Failed to load tests', e);
		throw error(500, 'Failed to load tests');
	}
};
