import { Auth, Projects } from '$lib/api';
import { clearAuthCookies } from '../../hooks.server';
import { parseProjectRoute } from '$lib/utils/urls';
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ cookies, request, url }) => {
	const cookieHeader = request.headers.get('cookie');

	const response = await Auth.me({ headers: { cookie: cookieHeader } });

	if (response.error) {
		clearAuthCookies(cookies);
		throw redirect(303, '/login');
	}

	const me = response.data;

	let project = null;
	const { projectId } = parseProjectRoute(url.pathname);

	if (projectId) {
		const projectResponse = await Projects.getProject({
			headers: { cookie: cookieHeader },
			path: { project_id: projectId }
		});
		if (projectResponse.data) {
			project = projectResponse.data;
		}
	}

	return {
		user: me,
		project
	};
};
