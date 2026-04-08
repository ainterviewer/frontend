import { Admin, type InvitationPublic } from '$lib/api';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { cookieHeader } = locals;

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
