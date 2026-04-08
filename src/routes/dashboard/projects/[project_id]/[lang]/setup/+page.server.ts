import { Projects } from '$lib/api';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const { project_id, lang } = params;
	const { cookieHeader } = locals;

	const [consentRes, welcomeRes, guideRes] = await Promise.all([
		Projects.getConsent({
			path: { project_id, language: lang },
			headers: { cookie: cookieHeader || '' }
		}),
		Projects.getWelcome({
			path: { project_id, language: lang },
			headers: { cookie: cookieHeader || '' }
		}),
		Projects.getGuide({
			path: { project_id, lang },
			headers: { Cookie: cookieHeader || '' }
		})
	]);

	return {
		consent: consentRes.error ? null : (consentRes.data ?? null),
		welcome: welcomeRes.error ? null : (welcomeRes.data ?? null),
		guide: guideRes.error ? null : (guideRes.data ?? null)
	};
};
