import { Analysis, Projects } from '$lib/api';
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
		// The requests are started here rather than in the component so they are
		// under way before the page exists: `app.html` opts into
		// `preload-data="hover"`, so these usually go out while the pointer is
		// still on the sidebar link. Deliberately not awaited — navigation must
		// not wait on a 165 KB cluster payload, and the skeletons cover the gap.
		status: Analysis.getEmbeddingStatus({ path }),
		clusters: Analysis.clusterEmbeddings({ path, query: clusterQuery(defaultClusterSettings()) }),
		// The guide behind the question filter. Fetched rather than read off the
		// cluster response's `groups`, which only ever describe the corpus as
		// currently filtered: a picker built from those would lose the option
		// that is filtering it, leaving no way back. Small next to the cluster
		// payload and started alongside it, so it is not what the page waits on.
		guide: Projects.getGuide({ path: { project_id: params.project_id, lang: params.lang } }),
		// The survey answers the cohort filter is built from. Deliberately not
		// narrowed by anything: the counts beside the values describe the whole
		// corpus, so filtering cannot make an option vanish from under the
		// selection that produced it. Small, and started with the rest.
		surveyFacets: Analysis.readSurveyFacets({ path })
	};
};
