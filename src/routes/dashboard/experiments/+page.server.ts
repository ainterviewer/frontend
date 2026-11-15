import { error } from '@sveltejs/kit';

import { Experiments, Folders } from '$lib/api/sdk.gen';
import { isDemoRestricted } from '$lib/utils/errors';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const options = {};

	const [foldersResponse, experimentsResponse] = await Promise.all([
		Folders.getFolders(options),
		Experiments.getExperiments(options)
	]);

	if (foldersResponse.error) {
		console.error('Failed to load folders', foldersResponse.error);
		throw error(500, 'Failed to load folders');
	}

	if (experimentsResponse.error) {
		// Refused to a demo account: no experiments, for the page's
		// restriction overlay to cover. See `isDemoRestricted`.
		if (isDemoRestricted(experimentsResponse.error)) {
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
