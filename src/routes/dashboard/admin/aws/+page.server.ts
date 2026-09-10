import { Admin } from '$lib/api';
import type { PageServerLoad } from './$types';
import type { SettingsByService } from './types';

export const load: PageServerLoad = async ({ locals }) => {
	const { cookieHeader } = locals;

	const response = await Admin.proxyToEc2ManagerGet({
		path: { full_path: 'settings' },
		headers: { cookie: cookieHeader }
	});

	if (response.error || !response.data || typeof response.data !== 'object') {
		console.error('Failed to fetch settings:', response.error);
		// An empty map renders the panel with nothing to configure, rather than
		// inventing pool names the proxy never reported.
		return { settings: {} satisfies SettingsByService };
	}

	return {
		settings: response.data as SettingsByService
	};
};
