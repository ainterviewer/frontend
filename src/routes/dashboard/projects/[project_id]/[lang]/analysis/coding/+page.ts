import type { PageLoad } from './$types';

// The canvas is a viewport the reader pans, zooms and drags nodes around in,
// and Svelte Flow measures the pane before it can draw anything. None of that
// exists on the server, so a server render would paint an empty box and then
// throw it away. The sibling explore and report pages opt out for the same
// reason.
export const ssr = false;

export const load: PageLoad = ({ params }) => {
	// Nothing to fetch yet: the codebook lives in the browser until the backend
	// exists. The ids are here so the page can already say which project's
	// codebook this is, and so the eventual load has somewhere obvious to go.
	return { project_id: params.project_id, lang: params.lang };
};
