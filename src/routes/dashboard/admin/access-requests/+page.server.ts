import { error } from '@sveltejs/kit';

import { Admin } from '$lib/api';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { cookieHeader } = locals;

	const response = await Admin.getAccessRequests({
		headers: {
			cookie: cookieHeader
		}
	});

	if (response.error) {
		console.error('Failed to load access requests', response.error);
		error(500, 'Failed to load access requests');
	}

	return {
		requests: response.data ?? []
	};
};
