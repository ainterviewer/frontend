import { Admin, type InvitationPublic } from '$lib/api';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies }) => {
	const token = cookies.get('token');

	try {
		const response = await Admin.getInvitations({
			headers: {
				Cookie: `token=${token}`
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
	} catch (e: any) {
		console.error(e);
		return {
			invitations: [],
			error: e.message || 'Failed to fetch invitations'
		};
	}
};
