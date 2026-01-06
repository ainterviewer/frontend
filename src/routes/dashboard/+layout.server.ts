import { Auth, Projects } from '$lib/api';
import { parseProjectRoute } from '$lib/utils/urls';
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ cookies, request, url }) => {
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
