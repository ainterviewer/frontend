import type { PreviewFeature } from '$lib/api/types.gen';

/** Every preview feature, in the order the admin pages list them. */
export const PREVIEW_FEATURES: { value: PreviewFeature; label: string }[] = [
	{ value: 'participants', label: 'Participants & email' },
	{ value: 'codebook', label: 'Codebook, coding & explore' },
	{ value: 'report', label: 'Report' },
	{ value: 'audio', label: 'Audio answers' },
	{ value: 'probing', label: 'Probing strategies' },
	{ value: 'safety', label: 'Safety check' }
];

/**
 * Whether `user` has been given `feature`, or with a list, any of them.
 *
 * The backend gates each feature's routes the same way (`require_preview`),
 * with no admin bypass, so this mirrors what will actually load.
 */
export function hasPreview(
	user: { preview_features?: PreviewFeature[] } | null | undefined,
	feature: PreviewFeature | PreviewFeature[]
): boolean {
	const held = user?.preview_features ?? [];
	const wanted = Array.isArray(feature) ? feature : [feature];
	return wanted.some((f) => held.includes(f));
}

/** Whether two lists name the same features, in any order. */
export function sameFeatures(a: PreviewFeature[], b: PreviewFeature[]): boolean {
	return a.length === b.length && a.every((f) => b.includes(f));
}
