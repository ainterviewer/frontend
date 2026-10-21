import { Admin, type UserAdmin } from '$lib/api';

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
		console.error(response.error);
		return {
			users: [],
			demoLimitDefaults,
			error: 'Failed to load users'
		};
	}

	return {
		users: (response.data as unknown as UserAdmin[]) || [],
		demoLimitDefaults,
		error: null
	};
};
