import { redirect } from '@sveltejs/kit';

import { loadContentStatus } from '$lib/content/status';
import { offeredLanguage } from '$lib/utils/languages';

import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ params, parent, url, fetch }) => {
	// Fetched again on every navigation in the project, which reading the path
	// makes this load rerun on: the sidebar marks the parts that are invalid
	// by it, and a part fixed on one page must not stay marked on the next.
	void url.pathname;
	const contentStatus = loadContentStatus(params.project_id, fetch);

	// The dashboard layout has loaded the project already. Without it (the
	// call failed) there is nothing to check against, and the pages report the
	// failure themselves.
	const { project } = await parent();
	const languages = project?.available_languages ?? [];
	const lang = offeredLanguage(languages, params.lang);

	// A language the project does not offer, typed into the URL, would open
	// every editor on it as one more untranslated language, and a save would
	// write text in it. Send the user to the language they meant instead.
	if (lang && lang !== params.lang) {
		const from = `/${params.project_id}/${params.lang}`;
		const to = `/${params.project_id}/${lang}`;
		redirect(307, url.pathname.replace(from, to) + url.search);
	}

	return { contentStatus: await contentStatus };
};
