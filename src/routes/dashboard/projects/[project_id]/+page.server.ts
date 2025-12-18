import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	// TODO: Fetch the project's default language from the database instead of hardcoding 'en'
	redirect(302, `${url.pathname}/en/guide`);
};
