import { Analysis, Projects } from '$lib/api';
import { codesFromApi } from '$lib/coding/codebookApi';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const { project_id, interview_id, lang } = params;
	const { cookieHeader } = locals;

	// Fetch messages, the codebook and the guide in parallel
	const [messagesRes, codebookRes, guideRes] = await Promise.all([
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
		}),
		// For the conditions a question was subject to. The transcript already
		// shows a skipped question faded; the guide is what says why it was
		// skipped, and what the questions that *were* asked depended on.
		Projects.getGuide({
			path: { project_id, lang },
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
			guide: null,
			project_id,
			interview_id,
			lang,
			error: 'Failed to fetch interview messages'
		};
	}

	return {
		messages: messagesRes.data || [],
		codes: codesFromApi(codebookRes.data?.codes ?? []),
		// Optional on purpose: a guide that cannot be read costs the condition
		// notes and nothing else, and a transcript is worth reading without them.
		guide: guideRes.data ?? null,
		project_id,
		interview_id,
		lang,
		error: null
	};
};
