import { Monitoring } from '$lib/api';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies, params }) => {
	const token = cookies.get('token') || '';
	const { data, error } = await Monitoring.getProjectMonitoringStats({
		auth: token,
		path: {
			project_id: params.project_id
		}
	});

	if (error) {
		return json({ error: 'Failed to load monitoring stats' }, { status: 500 });
	}

	return json(data);
};
