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

// Pill colours per kind. Autosaves are the bulk of the list, so they stay
// grey and the deliberate snapshots stand out. Green is kept for "Live".
export const KIND_PILL: Record<ContentVersionKind, string> = {
	publish: 'bg-blue-100 text-blue-800',
	manual: 'bg-violet-100 text-violet-800',
	test: 'bg-amber-100 text-amber-800',
	restore: 'bg-gray-100 text-gray-600',
	auto: 'bg-gray-100 text-gray-500'
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
