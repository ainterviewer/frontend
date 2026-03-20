import { Experiments, Folders } from '$lib/api/sdk.gen';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ request }) => {
	const cookieHeader = request.headers.get('cookie');

	const options = {
		headers: {
			cookie: cookieHeader
		}
	};

	const [foldersResponse, experimentsResponse] = await Promise.all([
		Folders.getFolders(options),
		Experiments.getExperiments(options)
	]);

	const folders = foldersResponse.data || [];

	return {
		folders,
		experiments: experimentsResponse.data || []
	};
};
