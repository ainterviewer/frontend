import { redirect } from '@sveltejs/kit';

import { loginNext } from '$lib/utils/urls';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies, url }) => {
	if (cookies.get('access_token')) {
		redirect(303, loginNext(url.searchParams.get('next')));
	}
};
