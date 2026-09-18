import { Me } from '$lib/api';
import type { MessageReportRowPublic } from '$lib/api/types.gen';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { cookieHeader } = locals;

	// Every project the user collaborates on, in one queue — the same scope the
	// account-menu badge counts, so the two can never disagree. Unfiltered: the
	// page facets and counts the whole set client-side, as the admin queue does.
	const response = await Me.getMyReports({
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
