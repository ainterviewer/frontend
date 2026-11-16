import { redirect } from '@sveltejs/kit';

import { loginNext } from '$lib/utils/urls';

import type { PageServerLoad } from './$types';
import { REMEMBER_ME_COOKIE } from './rememberMe';

export const load: PageServerLoad = async ({ cookies, url }) => {
	if (cookies.get('access_token')) {
		redirect(303, loginNext(url.searchParams.get('next')));
	}

	// The last "Remember me" choice, set by the login page when it is toggled.
	return { rememberMe: cookies.get(REMEMBER_ME_COOKIE) === '1' };
};
