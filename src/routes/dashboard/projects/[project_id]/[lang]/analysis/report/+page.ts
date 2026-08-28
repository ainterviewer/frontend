import { Report } from '$lib/api';
import type { PageLoad } from './$types';
import { defaultQuery } from './filters';

export const ssr = false;

export const load: PageLoad = ({ params }) => {
	return {
		project_id: params.project_id,
		// Started here rather than in the component so it is under way before
		// the page exists: `app.html` opts into `preload-data="hover"`, so this
		// usually goes out while the pointer is still on the link and the cards
		// have their answers by the time they mount. Deliberately not awaited --
		// navigation must not wait on it, and the skeletons cover the gap when
		// it does not arrive in time.
		distributions: Report.getProjectItemDistributions({
			path: { project_id: params.project_id },
			query: defaultQuery()
		})
	};
};
