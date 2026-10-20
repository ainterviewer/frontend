// A flagged message is either a respondent's report of a question or the
// safety check intervening on an answer (`source`). These read both the same
// way wherever flags are listed: the queues and the transcript.

import type { InterviewType, MessageReportPublic, ReportSource, SafetyFlag } from '$lib/api';

export const SOURCE_LABELS: Record<ReportSource, string> = {
	respondent: 'Respondent',
	safety_check: 'Safety check'
};

/** Which kind of interview a flag was raised in: a real respondent's, or
 *  someone testing the project. Synthetic tests never raise a safety flag,
 *  but nothing stops a report row from naming one. */
export const INTERVIEW_TYPE_LABELS: Record<InterviewType, string> = {
	distributed: 'Distributed',
	manual_test: 'Manual test',
	synthetic_test: 'Synthetic test'
};

const ACTION_LABELS: Record<SafetyFlag['action'], string> = {
	end_interview: 'ended the interview',
	skip_section: 'skipped the rest of the section',
	skip_probes: 'skipped the remaining probes'
};

/** A policy decision's identifier as words: `self_harm` -> "self harm". */
export function decisionLabel(decision: string): string {
	return decision.replaceAll('_', ' ');
}

/** What a flag was raised for: the respondent's reason, or the decision that
 *  triggered the safety check. */
export function flagReason(report: Pick<MessageReportPublic, 'reason' | 'safety'>): string {
	if (report.safety) return decisionLabel(report.safety.decision);
	return report.reason ?? '';
}

/** One sentence on what the safety check did, and what the respondent did
 *  about it. */
export function flagSummary(safety: SafetyFlag): string {
	const did = `The safety check ${ACTION_LABELS[safety.action]}`;
	if (safety.override === 'override')
		return `${did}, but the respondent overrode it and continued.`;
	if (safety.override === 'accept') return `${did}; the respondent accepted.`;
	if (safety.respondent_override) return `${did}, unless the respondent overrode it.`;
	return `${did}.`;
}
