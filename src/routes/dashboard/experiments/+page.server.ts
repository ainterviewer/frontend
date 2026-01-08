import { Projects, Experiments } from '$lib/api/sdk.gen';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies }) => {
	const token = cookies.get('token');

	const options = {
		headers: {
			Cookie: `token=${token}`
		}
	};

	const [foldersResponse, experimentsResponse] = await Promise.all([
		Projects.getFolders(options),
		Experiments.getExperiments(options)
	]);

	const folders = foldersResponse.data || [];

	return {
		folders,
		experiments: experimentsResponse.data || []
	};
};
