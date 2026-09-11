import { Analysis, Projects } from '$lib/api';
import type { PageLoad } from './$types';
import { clusterQuery, cohortQuery } from './explore';
import { clusterSettingsOf, readExploreUrl } from './exploreUrl';

// The page is a map the reader drags, zooms and re-clusters; none of that
// survives a server render, and the first thing it would paint is a scatter of
// nothing. The sibling report page opts out for the same reason.
export const ssr = false;

export const load: PageLoad = ({ params, url }) => {
	const path = { project_id: params.project_id };
	// The view the link asks for, which is the view worth preloading. A shared
	// link is usually a *narrowed* one -- that is what there was to share -- so
	// preloading the defaults instead would mean fetching a map nobody asked for
	// and then fetching the right one once the component mounted.
	const opened = readExploreUrl(url.searchParams);
	const settings = clusterSettingsOf(opened);
	const facets = cohortQuery(opened.filters);

	return {
		project_id: params.project_id,
		// Returned alongside the requests so the component can tell whether its
		// own state still asks what these asked. They start identical and part
		// company on the reader's first click, and a comparison against the
		// page's defaults could not see the difference on a shared link.
		clusterSettings: settings,
		facetQuery: facets,
		// The requests are started here rather than in the component so they are
		// under way before the page exists: `app.html` opts into
		// `preload-data="hover"`, so these usually go out while the pointer is
		// still on the sidebar link. Deliberately not awaited — navigation must
		// not wait on a 165 KB cluster payload, and the skeletons cover the gap.
		status: Analysis.getEmbeddingStatus({ path }),
		clusters: Analysis.clusterEmbeddings({ path, query: clusterQuery(settings) }),
		// The guide behind the question filter. Fetched rather than read off the
		// cluster response's `groups`, which only ever describe the corpus as
		// currently filtered: a picker built from those would lose the option
		// that is filtering it, leaving no way back. Small next to the cluster
		// payload and started alongside it, so it is not what the page waits on.
		guide: Projects.getGuide({ path: { project_id: params.project_id, lang: params.lang } }),
		// The survey answers the cohort filter is built from. Counted over the
		// cohort the link opens on, for the same reason the clustering is: the
		// numbers beside the values describe the interviews in view, and on a
		// shared link those are not the whole corpus.
		surveyFacets: Analysis.readSurveyFacets({ path, query: facets })
	};
};
