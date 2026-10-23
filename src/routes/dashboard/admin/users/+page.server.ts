import { error } from '@sveltejs/kit';

import { Admin } from '$lib/api';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [response, defaultsResponse] = await Promise.all([
		Admin.getUsers(),
		Admin.getDemoLimitDefaults()
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
