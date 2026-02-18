import { Experiments, Folders } from '$lib/api/sdk.gen';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies }) => {
	const token = cookies.get('token');

	const options = {
		headers: {
			Cookie: `token=${token}`
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
