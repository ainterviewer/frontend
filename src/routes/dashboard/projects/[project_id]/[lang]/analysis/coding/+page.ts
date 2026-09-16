import type { PageLoad } from './$types';

// The canvas is a viewport the reader pans, zooms and drags nodes around in,
// and Svelte Flow measures the pane before it can draw anything. None of that
// exists on the server, so a server render would paint an empty box and then
// throw it away. The sibling explore and report pages opt out for the same
// reason.
export const ssr = false;

export const load: PageLoad = ({ params }) => {
	// The codebook itself is not fetched here. It is read through
	// `$lib/coding/store.svelte`, which holds one per project for however long
	// the tab lives, so that navigating between this page and the explore
	// page's code pane neither refetches it nor forks it.
	return { project_id: params.project_id, lang: params.lang };
};
