import { error } from '@sveltejs/kit';

import { Synthesize } from '$lib/api';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, fetch }) => {
	const { project_id } = params;

	const { data, error: fetchError } = await Synthesize.getTestSetups({
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
