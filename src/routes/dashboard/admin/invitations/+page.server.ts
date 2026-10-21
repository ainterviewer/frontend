import { Admin, type InvitationPublic } from '$lib/api';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { cookieHeader } = locals;

	const [response, defaultsResponse] = await Promise.all([
		Admin.getInvitations({
			headers: {
				cookie: cookieHeader
			}
		}),
		Admin.getDemoLimitDefaults({ headers: { cookie: cookieHeader } })
	]);
	// Only the placeholders of the demo limit fields; the page works without.
	const demoLimitDefaults = defaultsResponse.data ?? null;

	if (response.error) {
		console.error(response.error);
		return {
			invitations: [],
			demoLimitDefaults,
			error: String(response.error)
		};
	}

	return {
		invitations: (response.data as unknown as InvitationPublic[]) ?? [],
		demoLimitDefaults,
		error: null
	};
};
