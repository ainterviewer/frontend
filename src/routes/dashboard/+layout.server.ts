import { Auth, Default, Projects } from '$lib/api';
import { clearAuthCookies } from '../../hooks.server';
import { parseProjectRoute } from '$lib/utils/urls';
import { error, redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ cookies, locals, url }) => {
	const { cookieHeader } = locals;

	// Releases ride along with the version call so the "What's new" dot can be
	// rendered without a second round trip — and so it keys off the newest
	// release that has something to announce rather than the deployed version,
	// which may not have been written up yet, or may have nothing to write up.
	const { projectId } = parseProjectRoute(url.pathname);

	const [response, platformVer, releases, projectResponse, permissionsResponse] = await Promise.all(
		[
			Auth.me({ headers: { cookie: cookieHeader } }),
			Default.version({}),
			Default.releases({ query: { limit: 10 } }),
			projectId
				? Projects.getProject({
						headers: { cookie: cookieHeader },
						path: { project_id: projectId }
					})
				: null,
			// What this user may do in the project, so the UI can leave out actions
			// the API would refuse — moderating other people's comments, above all.
			projectId
				? Projects.getProjectPermissions({
						headers: { cookie: cookieHeader },
						path: { project_id: projectId }
					})
				: null
		]
	);

	if (response.error) {
		if (!response.response) {
			throw error(503, 'Backend unavailable');
		}
		if (response.response?.status && response.response.status >= 500) {
			throw error(503, 'Backend unavailable');
		}
		clearAuthCookies(cookies);
		throw redirect(303, '/login');
	}

	const me = response.data;
	if (!me) {
		throw error(503, 'Backend unavailable');
	}

	let project = null;
	if (projectResponse?.error) {
		console.error('Failed to load project:', projectResponse.error);
	} else if (projectResponse?.data) {
		project = projectResponse.data;
	}

	// Absent permissions mean the least rights, never the most: a failed call
	// must not hand somebody moderation buttons.
	let permissions = null;
	if (permissionsResponse?.error) {
		console.error('Failed to load project permissions:', permissionsResponse.error);
	} else if (permissionsResponse?.data) {
		permissions = permissionsResponse.data;
	}

	return {
		user: me,
		project,
		permissions,
		platformVersion: platformVer.data,
		releases: releases.data ?? []
	};
};
