import { error } from '@sveltejs/kit';

import { Admin } from '$lib/api';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { cookieHeader } = locals;

	const [response, defaultsResponse] = await Promise.all([
		Admin.getUsers({
			headers: {
				cookie: cookieHeader
			}
		}),
		Admin.getDemoLimitDefaults({ headers: { cookie: cookieHeader } })
	]);
	// Only the placeholders of the demo limit fields; the page works without.
	const demoLimitDefaults = defaultsResponse.data ?? null;

	if (response.error) {
		console.error('Failed to load users', response.error);
		error(500, 'Failed to load users');
	}

	return {
		users: response.data ?? [],
		demoLimitDefaults
	};
};
