import { Auth, Default, Me, Projects } from '$lib/api';
import { clearAuthCookies } from '../../hooks.server';
import { parseProjectRoute } from '$lib/utils/urls';
import { error, redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ cookies, depends, locals, url }) => {
	const { cookieHeader } = locals;

	// Declared so the account-menu badge can be refreshed on its own, without
	// a navigation: the dashboard layout re-runs this load on
	// `invalidate('app:notifications')`. See the poll in +layout.svelte.
	depends('app:notifications');

	// Releases ride along with the version call so the "What's new" dot can be
	// rendered without a second round trip — and so it keys off the newest
	// release that has something to announce rather than the deployed version,
	// which may not have been written up yet, or may have nothing to write up.
	const { projectId } = parseProjectRoute(url.pathname);

	const [
		response,
		platformVer,
		releases,
		notificationsResponse,
		projectResponse,
		permissionsResponse
	] = await Promise.all([
		Auth.me({ headers: { cookie: cookieHeader } }),
		Default.version({}),
		Default.releases({ query: { limit: 10 } }),
		// Badge counts for the account menu. In this fan-out rather than a
		// client fetch so the dot is right on the first paint.
		Me.getNotifications({ headers: { cookie: cookieHeader } }),
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

	// A failed count is no badge, never a stale or invented one: the menu row
	// simply does not appear, which is the same as having nothing waiting.
	if (notificationsResponse.error) {
		console.error('Failed to load notifications:', notificationsResponse.error);
	}

	return {
		user: me,
		project,
		permissions,
		platformVersion: platformVer.data,
		releases: releases.data ?? [],
		notifications: notificationsResponse.data ?? null
	};
};
