import { Admin } from '$lib/api';
import type { PageServerLoad } from './$types';

interface AccessRequest {
	id: string;
	name: string;
	email: string;
	organization: string | null;
	status: string;
	message: string | null;
	created_at: string;
	updated_at: string;
}

export const load: PageServerLoad = async ({ request }) => {
	const cookieHeader = request.headers.get('cookie');

	const response = await Admin.getAccessRequests({
		headers: {
			cookie: cookieHeader
		}
	});

	if (response.error) {
		console.error(response.error);
		return {
			requests: [],
			error: String(response.error)
		};
	}

	return {
		requests: (response.data as unknown as AccessRequest[]) ?? [],
		error: null
	};
};
