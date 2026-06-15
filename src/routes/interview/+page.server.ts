import { Auth, Projects, type InterviewType } from '$lib/api';
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, cookies, request, locals }) => {
	const project_id = url.searchParams.get('id');

	if (!project_id) {
		redirect(303, '/');
	}

	const interviewType: InterviewType =
		(url.searchParams.get('interview_type') as InterviewType) || 'distributed';

	// Auth check for test interview types
	let authError = false;
	if (interviewType === 'manual_test' || interviewType === 'synthetic_test') {
		if (!cookies.get('access_token') && !cookies.get('refresh_token')) {
			authError = true;
		} else {
			const response = await Auth.me({ headers: { cookie: locals.cookieHeader } });
			if (response.error) {
				if (!response.response || response.response.status >= 500) {
					throw error(503, 'Backend unavailable');
				}
				authError = true;
			}
		}
	}

	const { cookieHeader } = locals;

	const { data: interviewConfig, error: configError } = await Projects.getInterviewConfig({
		headers: { cookie: cookieHeader },
		path: { project_id }
	});

	const { data: isProjectOwnerDemoUser } = await Projects.checkProjectOwner({
		headers: { cookie: cookieHeader },
		path: { project_id }
	});

	if (configError) {
		console.error('Failed to load interview config', configError);
	}

	const langParam = url.searchParams.get('lang');
	const lang = langParam || 'en';
	const experimentID = url.searchParams.get('x');

	// If no lang param, fetch available languages for language picker
	let availableLanguages: Array<{ name: string; code: string }> = [];
	if (!langParam) {
		const { data: languages } = await Projects.getProjectLanguages({
			headers: { cookie: cookieHeader },
			path: { project_id }
		});
		if (languages && languages.length > 1) {
			availableLanguages = languages;
		}
	}

	// Collect extra query params (exclude known ones)
	const knownParams = new Set(['id', 'interview_type', 'lang', 'x']);
	const externalParams: Record<string, string> = {};
	for (const [key, value] of url.searchParams.entries()) {
		if (!knownParams.has(key)) {
			externalParams[key] = value;
		}
	}

	const referer = request.headers.get('referer') || null;

	return {
		project_id,
		lang,
		interviewType,
		experimentID,
		interviewConfig,
		isProjectOwnerDemoUser: isProjectOwnerDemoUser ?? false,
		authError,
		externalParams: Object.keys(externalParams).length > 0 ? externalParams : null,
		referer,
		availableLanguages
	};
};
