import { Analysis, Projects } from '$lib/api';
import { codesFromApi } from '$lib/coding/codebookApi';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const { project_id, interview_id, lang } = params;
	const { cookieHeader } = locals;

	// Fetch messages and the codebook in parallel
	const [messagesRes, codebookRes] = await Promise.all([
		Projects.getInterviewMessages({
			path: {
				project_id,
				interview_id
			},
			headers: {
				cookie: cookieHeader || ''
			}
		}),
		// The codebook, so the transcript can show what each passage is coded as
		// and offer the codes to apply. Read-only here -- a codebook is edited
		// on the Coding page.
		Analysis.getCodebook({
			path: { project_id },
			headers: {
				cookie: cookieHeader || ''
			}
		})
	]);

	if (messagesRes.error) {
		console.error('Error fetching interview messages:', messagesRes.error);
		return {
			messages: [],
			codes: [],
			project_id,
			interview_id,
			lang,
			error: 'Failed to fetch interview messages'
		};
	}

	return {
		messages: messagesRes.data || [],
		codes: codesFromApi(codebookRes.data?.codes ?? []),
		project_id,
		interview_id,
		lang,
		error: null
	};
};
