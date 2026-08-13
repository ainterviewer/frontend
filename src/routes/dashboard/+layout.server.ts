import { Auth, Default, Projects } from '$lib/api';
import { clearAuthCookies } from '../../hooks.server';
import { parseProjectRoute } from '$lib/utils/urls';
import { error, redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ cookies, locals, url }) => {
	const { cookieHeader } = locals;

	// Releases ride along with the version call so the "What's new" dot can be
	// rendered without a second round trip — and so it keys off the newest
	// *curated* release rather than the deployed version, which may not have
	// been written up yet.
	const [response, platformVer, releases] = await Promise.all([
		Auth.me({ headers: { cookie: cookieHeader } }),
		Default.version({}),
		Default.releases({ query: { limit: 10 } })
	]);

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
	const { projectId } = parseProjectRoute(url.pathname);

	if (projectId) {
		const projectResponse = await Projects.getProject({
			headers: { cookie: cookieHeader },
			path: { project_id: projectId }
		});
		if (projectResponse.error) {
			console.error('Failed to load project:', projectResponse.error);
		} else if (projectResponse.data) {
			project = projectResponse.data;
		}
	}

	return {
		user: me,
		project,
		platformVersion: platformVer.data,
		releases: releases.data ?? []
	};
};
