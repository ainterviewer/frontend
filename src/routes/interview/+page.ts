import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import type { InterviewType } from '$lib/api';

export const load: PageLoad = ({ url }) => {
	const project_id: string | null = url.searchParams.get('id');

	if (!project_id) {
		redirect(303, '/');
	}

	const lang: string = url.searchParams.get('lang') || 'en';
	const interviewType: InterviewType | null = url.searchParams.get('interview_type');
	const experimentID: string | null = url.searchParams.get('x');

	// We can pass other params too if needed
	return {
		project_id,
		lang,
		interviewType,
		experimentID
	};
};
