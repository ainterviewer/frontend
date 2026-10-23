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

	return {
		consent: consentRes.error ? null : (consentRes.data ?? null),
		welcome: welcomeRes.error ? null : (welcomeRes.data ?? null),
		guide: guideRes.error ? null : (guideRes.data ?? null),
		config: configRes.error ? null : (configRes.data ?? null),
		external_params: projectRes.data?.external_params ?? []
	};
};
