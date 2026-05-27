import { Admin } from '$lib/api';
import type { PageServerLoad } from './$types';
import type { SettingsData } from './types';

export const load: PageServerLoad = async ({ locals }) => {
	const { cookieHeader } = locals;

	const response = await Admin.proxyToEc2Manager2({
		path: { full_path: 'settings' },
		headers: { cookie: cookieHeader }
	});

	if (response.error || !response.data || typeof response.data !== 'object') {
		console.error('Failed to fetch settings:', response.error);
		return {
			settings: {
				min_instances: 0,
				start: false,
				stop: false,
				ec2_downtime: null
			} satisfies SettingsData
		};
	}

	return {
		settings: response.data as SettingsData
	};
};
