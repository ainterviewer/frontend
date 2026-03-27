import { Admin, type InvitationPublic } from '$lib/api';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ request }) => {
	const cookieHeader = request.headers.get('cookie');

	const response = await Admin.getInvitations({
		headers: {
			cookie: cookieHeader
		}
	});

	if (response.error) {
		console.error(response.error);
		return {
			invitations: [],
			error: String(response.error)
		};
	}

	return {
		invitations: (response.data as unknown as InvitationPublic[]) ?? [],
		error: null
	};
};
