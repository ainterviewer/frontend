import type { PageLoad } from './$types';

export const ssr = false;

export const load: PageLoad = ({ params }) => {
	return {
		project_id: params.project_id
	};
};
