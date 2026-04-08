import { Projects } from '$lib/api';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const { project_id, lang } = params;
	const { cookieHeader } = locals;

	const [consentRes, projectRes] = await Promise.all([
		Projects.getConsent({
			path: { project_id, language: lang },
			headers: {
				cookie: cookieHeader || ''
			}
		}),
		Projects.getProject({
			path: { project_id },
			headers: {
				cookie: cookieHeader || ''
			}
		})
	]);

	if (consentRes.error) {
		console.error('Failed to load consent', consentRes.error);
		throw error(500, 'Failed to load consent settings');
	}

	return {
		consent: consentRes.data,
		available_languages: projectRes.data?.available_languages ?? [],
		project_name: projectRes.data?.title ?? ''
	};
};
