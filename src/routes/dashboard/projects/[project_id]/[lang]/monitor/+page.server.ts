import { Monitoring } from '$lib/api';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies, params }) => {
	const token = cookies.get('token') || '';
	const { data, error } = await Monitoring.getProjectMonitoringStats({
		auth: token,
		path: {
			project_id: params.project_id
		}
	});

	if (error) {
		console.error('Failed to load monitoring stats:', error);
		throw new Error('Failed to load monitoring stats');
	}

	return {
		stats: data
	};
};
