import { Synthesize } from '$lib/api';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, request, fetch }) => {
	const { project_id } = params;
	const cookieHeader = request.headers.get('cookie');

	const { data, error: fetchError } = await Synthesize.getTestSetups({
		headers: { cookie: cookieHeader },
		fetch,
		path: { project_id }
	});

	if (fetchError) {
		console.error('Failed to load tests', fetchError);
		throw error(500, 'Failed to load tests');
	}

	return {
		tests: data || []
	};
};
