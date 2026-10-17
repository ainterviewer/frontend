import { Admin, type AdminStats } from '$lib/api';

import type { PageServerLoad } from './$types';
import { parseRange } from './ranges';

export const load: PageServerLoad = async ({ locals, url }) => {
	const { cookieHeader } = locals;
	const range = parseRange(url.searchParams.get('range'));

	const response = await Admin.getAdminStats({
		query: range === 'all' ? {} : { days: Number(range) },
		headers: { cookie: cookieHeader }
	});

	if (response.error) {
		console.error(response.error);
		return { range, stats: null as AdminStats | null, error: 'Failed to load statistics' };
	}

	return { range, stats: response.data as AdminStats, error: null };
};
