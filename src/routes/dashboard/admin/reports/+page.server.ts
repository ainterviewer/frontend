import { error } from '@sveltejs/kit';

import { Admin } from '$lib/api';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	// Unfiltered: the page counts and facets the whole set client-side, as the
	// other admin tables do. Reports are rare enough that a queue of every one
	// there has ever been is a page, not a pagination problem.
	const response = await Admin.getReports();

	if (response.error) {
		console.error('Failed to load reports', response.error);
		error(500, 'Failed to load reports');
	}

	return {
		reports: response.data ?? []
	};
};
