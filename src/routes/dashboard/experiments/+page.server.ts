import { Experiments, Folders } from '$lib/api/sdk.gen';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { cookieHeader } = locals;

	const options = {
		headers: {
			cookie: cookieHeader
		}
	};

	const [foldersResponse, experimentsResponse] = await Promise.all([
		Folders.getFolders(options),
		Experiments.getExperiments(options)
	]);

	if (foldersResponse.error) {
		console.error('Failed to load folders', foldersResponse.error);
		throw error(500, 'Failed to load folders');
	}

	if (experimentsResponse.error) {
		if (experimentsResponse.response?.status === 403) {
			return {
				folders: foldersResponse.data || [],
				experiments: []
			};
		}
		console.error('Failed to load experiments', experimentsResponse.error);
		throw error(500, 'Failed to load experiments');
	}

	return {
		folders: foldersResponse.data || [],
		experiments: experimentsResponse.data || []
	};
};
