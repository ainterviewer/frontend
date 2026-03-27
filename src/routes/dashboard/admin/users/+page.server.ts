import { Admin, type UserAdmin } from '$lib/api';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ request }) => {
	const cookieHeader = request.headers.get('cookie');

	const response = await Admin.getUsers({
		headers: {
			cookie: cookieHeader
		}
	});

	if (response.error) {
		console.error(response.error);
		return {
			users: [],
			error: 'Failed to load users'
		};
	}

	return {
		users: (response.data as unknown as UserAdmin[]) || [],
		error: null
	};
};
