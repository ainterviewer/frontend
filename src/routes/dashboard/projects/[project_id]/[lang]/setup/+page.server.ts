import { error } from '@sveltejs/kit';

import { Projects } from '$lib/api';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const { project_id, lang } = params;

	// The draft's consent and welcome: this is the editor, not respondents.
	const [consentRes, welcomeRes, guideRes, configRes, projectRes] = await Promise.all([
		Projects.getConsent({
			path: { project_id, language: lang },
			query: { draft: true }
		}),
		Projects.getWelcome({
			path: { project_id, language: lang },
			query: { draft: true }
		}),
		Projects.getGuide({
			path: { project_id, lang }
		}),
		Projects.getInterviewConfig({
			path: { project_id }
		}),
		Projects.getProject({
			path: { project_id }
		})
	]);

	// Unconfigured content is a 200 `null`, so any error here is a real failure:
	// showing it as "Not configured" would hide it.
	const failed = (
		[
			['consent', consentRes],
			['welcome', welcomeRes],
			['guide', guideRes],
			['interview configuration', configRes],
			['project', projectRes]
		] as const
	).find(([, res]) => res.error);
	if (failed) {
		const [what, res] = failed;
		console.error(`Failed to load ${what}`, res.error);
		throw error(500, `Failed to load ${what}`);
	}

	return {
		consent: consentRes.data ?? null,
		welcome: welcomeRes.data ?? null,
		guide: guideRes.data ?? null,
		config: configRes.data ?? null,
		external_params: projectRes.data?.external_params ?? [],
		redirects: projectRes.data?.redirects ?? null,
		experiment_only: projectRes.data?.experiment_only ?? false
	};
};
