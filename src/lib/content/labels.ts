// Names for the values a version's content holds, shared by the history,
// its preview and the compare view.

import type { ContentVersionKind } from '$lib/api/types.gen';

export const KIND_LABEL: Record<ContentVersionKind, string> = {
	publish: 'Published',
	manual: 'Saved',
	test: 'Tested',
	restore: 'Before a restore',
	auto: 'Autosave'
};

export const SURVEY_LABEL: Record<string, string> = {
	radio: 'Single choice',
	checkbox: 'Multiple choice',
	likert: 'Likert scale',
	likert_grid: 'Likert grid',
	slider: 'Slider',
	number: 'Number',
	date: 'Date',
	datetime: 'Date and time',
	time: 'Time'
};

export const AGENT_LABEL: Record<string, string> = {
	probing: 'Probing',
	classification: 'Classification',
	guide: 'Guide',
	history: 'History',
	security: 'Security',
	answering: 'Answering',
	reformulation: 'Reformulation',
	visual: 'Visual'
};
