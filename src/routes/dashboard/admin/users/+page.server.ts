import { Admin, type UserAdmin } from '$lib/api';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies }) => {
	const token = cookies.get('token');

	try {
		const response = await Admin.getUsers({
			headers: {
				Cookie: `token=${token}`
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
	} catch (e) {
		console.error(e);
		return {
			users: [],
			error: 'An unexpected error occurred'
		};
	}
};
