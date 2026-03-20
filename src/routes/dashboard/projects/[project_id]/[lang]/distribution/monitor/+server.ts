import { Monitoring } from '$lib/api';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, params }) => {
	const cookieHeader = request.headers.get('cookie');
	const { data, error } = await Monitoring.getProjectMonitoringStats({
		headers: { cookie: cookieHeader },
		path: {
			project_id: params.project_id
		}
	});

	if (error) {
		return json({ error: 'Failed to load monitoring stats' }, { status: 500 });
	}

	return json(data);
};
