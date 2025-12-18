import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import type { TestType } from '$lib/api';

export const load: PageLoad = ({ url }) => {
	const project_id = url.searchParams.get('id');

	if (!project_id) {
		redirect(303, '/');
	}

	const lang = url.searchParams.get('lang') || 'en';
	const test: boolean = Boolean(url.searchParams.get('test')) || false;
	const testType: TestType | undefined = url.searchParams.get('test_type');
	const experimentID: string | undefined = url.searchParams.get('x');

	// We can pass other params too if needed
	return {
		project_id,
		lang,
		test,
		testType,
		experimentID
	};
};
