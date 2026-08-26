import { Auth, Interviews, Projects, type InterviewType } from '$lib/api';
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * The interview id inside an `interview_token` cookie, if it is for this
 * project.
 *
 * Decoded, not verified: SvelteKit has no access to the JWT secret, and does
 * not need it. This only decides which interview the page tries to reconnect
 * to. The websocket independently verifies the same cookie and reads the
 * interview id out of *it* (see the backend's websockets/auth.py and
 * interviews/ai.py), so a forged cookie changes what this page attempts and
 * nothing about what the server will actually serve.
 */
function resumableInterviewId(token: string | undefined, project_id: string): string | null {
	if (!token) return null;
	try {
		const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
		if (payload?.project_id !== project_id) return null;
		return typeof payload.interview_id === 'string' ? payload.interview_id : null;
	} catch {
		// A malformed cookie is simply not a resumable session.
		return null;
	}
}

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

	const { data: interviewModels, error: modelsError } = await Projects.getInterviewModels({
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
	if (modelsError) {
		console.error('Failed to load interview models', modelsError);
	}

	const langParam = url.searchParams.get('lang');
	const experimentID = url.searchParams.get('x');

	// Resolve the interview language against what the project actually has.
	// The link generated at project creation carries no `lang` param, so
	// defaulting to a hardcoded 'EN' silently disagreed with the backend
	// (which falls back to the project's default) for every project without an
	// English localization.
	const { data: projectLanguages } = await Projects.getProjectLanguages({
		headers: { cookie: cookieHeader },
		path: { project_id }
	});
	const languages = projectLanguages ?? [];

	const requested = langParam
		? languages.find((l) => l.code === langParam.toUpperCase())
		: undefined;
	const lang = (requested ?? languages.find((l) => l.is_default) ?? languages[0])?.code ?? 'EN';

	// Let the respondent choose whenever the project offers a choice and the
	// link didn't make one for them — including when it asked for a language
	// the project doesn't have.
	const languageUnresolved = !langParam || !requested;
	const availableLanguages = languageUnresolved && languages.length > 1 ? languages : [];

	// Which interview this browser already holds a session for, read out of the
	// httponly `interview_token` cookie the browser sends with this request.
	//
	// Read from the cookie rather than passed in the URL on purpose. The cookie
	// is the credential, so taking the id from the same artifact that authorises
	// it means the two can never disagree, and nothing interview-identifying
	// ends up in a URL that people forward.
	const resumeInterviewId = resumableInterviewId(cookies.get('interview_token'), project_id);

	// Collect extra query params (exclude known ones)
	const knownParams = new Set(['id', 'interview_type', 'lang', 'x']);
	const externalParams: Record<string, string> = {};
	for (const [key, value] of url.searchParams.entries()) {
		if (!knownParams.has(key)) {
			externalParams[key] = value;
		}
	}

	// Validate the link's params against the project's schema up front, so a
	// broken link fails on arrival instead of after the respondent has picked a
	// language and accepted the consent text. `createInterview` validates again
	// server-side; this only moves the feedback earlier.
	//
	// Only whether the link is valid, never which param is at fault: naming the
	// missing param would tell a respondent what to forge. The backend logs the
	// detail for the project owner.
	//
	// Test runs come from the dashboard rather than from a distributed link, so
	// they carry no link params to check; `create_interview` skips them too.
	//
	// Skipped when this browser already holds a session for an interview in this
	// project. There is nothing to check: the interview being reopened already
	// exists, and its params were validated when it was created. Without this,
	// returning to a project that requires params (a `pid`, say) failed here
	// whenever the URL didn't carry them again — which a resume link never does.
	// This only skips the pre-flight; `create_interview` validates server-side
	// before any *new* interview can be created.
	let paramsInvalid = false;
	if (interviewType === 'distributed' && !resumeInterviewId) {
		const { error: paramsError, response: paramsResponse } =
			await Interviews.validateInterviewParams({
				path: { project_id },
				body: { external_params: Object.keys(externalParams).length > 0 ? externalParams : null }
			});
		paramsInvalid = paramsResponse?.status === 422;
		if (paramsError && !paramsInvalid) {
			console.error('Failed to validate external params', paramsError);
		}
	}

	const referer = request.headers.get('referer') || null;

	return {
		project_id,
		lang,
		interviewType,
		experimentID,
		interviewConfig,
		interviewModels,
		isProjectOwnerDemoUser: isProjectOwnerDemoUser ?? false,
		authError,
		externalParams: Object.keys(externalParams).length > 0 ? externalParams : null,
		referer,
		availableLanguages,
		paramsInvalid,
		resumeInterviewId
	};
};
