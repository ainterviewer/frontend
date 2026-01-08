import { Synthesize } from '$lib/api';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, cookies, fetch }) => {
	const { project_id } = params;
	const token = cookies.get('token');

	try {
		const response = await Synthesize.getTestSetups({
			auth: token,
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
