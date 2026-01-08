import { Projects } from '$lib/api';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, request }) => {
	const { project_id, lang } = params;
	const cookieHeader = request.headers.get('cookie');

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
		consent: consentRes.data ?? null,
		welcome: welcomeRes.data ?? null,
		guide: guideRes.data ?? null
	};
};
