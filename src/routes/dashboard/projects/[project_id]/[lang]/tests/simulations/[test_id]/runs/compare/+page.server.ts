import { Default } from '$lib/api';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
	// To mark the models respondents' answers may not be sent to.
	const { data: models } = await Default.getModels({ fetch });
	return { models: models ?? [] };
};
