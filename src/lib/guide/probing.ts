import type { GuideQuestion } from './types';

type ProbingLimits = Pick<GuideQuestion, 'max_probes_n' | 'max_probes_time'>;

/** The probe limit new questions get, and the one "Add Probing" sets. */
export const DEFAULT_MAX_PROBES = 3;

/**
 * Whether follow-up probes are asked, as the lib's `should_probe` decides. A
 * cleared limit is null: no limit. Either limit at 0 turns probing off, and so
 * does having neither.
 */
export function probingEnabled(q: ProbingLimits): boolean {
	const n = q.max_probes_n ?? null;
	const time = q.max_probes_time ?? null;
	return n !== 0 && time !== 0 && (n !== null || time !== null);
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** One sentence on how far probing may go. */
export function probingSummary(q: ProbingLimits): string {
	if (!probingEnabled(q)) return 'No follow-up probes are asked.';
	const n = q.max_probes_n ?? null;
	const time = q.max_probes_time ?? null;
	const count = n !== null ? `Up to ${plural(n, 'follow-up probe')}` : null;
	const duration = time !== null ? `${plural(time, 'second')} of probing` : null;
	if (count && duration) return `${count}, or ${duration}, whichever runs out first.`;
	if (count) return `${count}, with no time limit.`;
	return `Follow-up probes for up to ${duration}, with no cap on how many.`;
}
