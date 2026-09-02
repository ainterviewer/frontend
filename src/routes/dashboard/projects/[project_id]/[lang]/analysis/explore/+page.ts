import { Analysis } from '$lib/api';
import type { PageLoad } from './$types';
import { clusterQuery, defaultClusterSettings } from './explore';

// The page is a map the reader drags, zooms and re-clusters; none of that
// survives a server render, and the first thing it would paint is a scatter of
// nothing. The sibling report page opts out for the same reason.
export const ssr = false;

export const load: PageLoad = ({ params }) => {
	const path = { project_id: params.project_id };

	return {
		project_id: params.project_id,
		// Both requests are started here rather than in the component so they are
		// under way before the page exists: `app.html` opts into
		// `preload-data="hover"`, so these usually go out while the pointer is
		// still on the sidebar link. Deliberately not awaited — navigation must
		// not wait on a 165 KB cluster payload, and the skeletons cover the gap.
		status: Analysis.getEmbeddingStatus({ path }),
		clusters: Analysis.clusterEmbeddings({ path, query: clusterQuery(defaultClusterSettings()) })
	};
};
