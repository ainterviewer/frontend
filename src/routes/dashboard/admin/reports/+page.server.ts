import { Admin } from '$lib/api';
import type { MessageReportRowPublic } from '$lib/api/types.gen';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { cookieHeader } = locals;

	// Unfiltered: the page counts and facets the whole set client-side, as the
	// other admin tables do. Reports are rare enough that a queue of every one
	// there has ever been is a page, not a pagination problem.
	const response = await Admin.getReports({
		headers: {
			cookie: cookieHeader
		}
	});

	if (response.error) {
		console.error(response.error);
		return {
			reports: [] as MessageReportRowPublic[],
			error: String(response.error)
		};
	}

	return {
		reports: response.data ?? [],
		error: null
	};
};
