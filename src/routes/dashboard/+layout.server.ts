import { Auth } from '$lib/api';
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ cookies, request }) => {
	const token = cookies.get('token');

	if (!token) {
		throw redirect(303, '/login');
	}

	const cookieHeader = request.headers.get('cookie');

	const response = await Auth.me({ headers: { cookie: cookieHeader } });

	// Check if your API client exposes the status
	if (response.error) {
		cookies.delete('token', { path: '/' });
		throw redirect(303, '/login');
	}

	const me = response.data;

	return {
		user: me
	};
};
