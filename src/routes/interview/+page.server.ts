import { Auth, Projects, type InterviewConfig, type InterviewType } from '$lib/api';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, cookies, request }) => {
	const project_id = url.searchParams.get('id');

	if (!project_id) {
		redirect(303, '/');
	}

	const interviewType: InterviewType =
		(url.searchParams.get('interview_type') as InterviewType) || 'distributed';

	// Auth check for test interview types
	let authError = false;
	if (interviewType === 'manual_test' || interviewType === 'synthetic_test') {
		const token = cookies.get('token');
		if (!token) {
			authError = true;
		} else {
			const cookieHeader = request.headers.get('cookie');
			const response = await Auth.me({ headers: { cookie: cookieHeader } });
			if (response.error) {
				authError = true;
			}
		}
	}

	const cookieHeader = request.headers.get('cookie');

	const { data: interviewConfig } = await Projects.getInterviewConfig({
		headers: { cookie: cookieHeader },
		path: { project_id }
	});

	const { data: isProjectOwnerDemoUser } = await Projects.checkProjectOwner({
		headers: { cookie: cookieHeader },
		path: { project_id }
	});

	const lang = url.searchParams.get('lang') || 'en';
	const experimentID = url.searchParams.get('x');

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
		referer
	};
};
