import type { SecurityAction, SecurityDecision, SecurityPolicy } from '$lib/api';

export const ACTION_LABELS: Record<SecurityAction, string> = {
	skip_probes: 'Skip the remaining probes',
	skip_section: 'Skip the rest of the section',
	end_interview: 'End the interview'
};

// A decision's key becomes a field of the response the model fills in, so the
// library only accepts a Python identifier. ASCII only here, which is stricter
// than Python and all a key needs.
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** What stops a policy from being saved, per decision (by index) and overall.
 *  Mirrors the library's validation, so the page can say what is wrong rather
 *  than save and be refused. */
export function policyErrors(policy: SecurityPolicy): {
	policy: string[];
	decisions: Map<number, string[]>;
} {
	const errors = { policy: [] as string[], decisions: new Map<number, string[]>() };

	if (policy.decisions.length === 0) {
		errors.policy.push('Add at least one decision.');
	}

	const names = policy.decisions.map((decision) => decision.name.trim());
	policy.decisions.forEach((decision, i) => {
		const problems: string[] = [];
		const name = names[i];

		if (!IDENTIFIER.test(name)) {
			problems.push(
				'The key may only contain letters, digits and underscores, and not start with a digit.'
			);
		} else if (names.indexOf(name) !== i) {
			problems.push(`Another decision already uses the key “${name}”.`);
		}
		if (!decision.description.trim()) {
			problems.push('The question for the model is empty.');
		}
		if (!(decision.threshold >= 0 && decision.threshold <= 1)) {
			problems.push('The threshold has to be between 0 and 1.');
		}
		if (!decision.action_text?.trim()) {
			problems.push('The message to the respondent is empty.');
		}

		if (problems.length > 0) errors.decisions.set(i, problems);
	});

	return errors;
}

/** A blank decision, with a key no other decision has. */
export function newDecision(policy: SecurityPolicy, actionText: string): SecurityDecision {
	const names = new Set(policy.decisions.map((decision) => decision.name));
	let n = policy.decisions.length + 1;
	while (names.has(`decision_${n}`)) n++;

	return {
		name: `decision_${n}`,
		description: '',
		threshold: 0.5,
		action: 'skip_probes',
		action_text: actionText,
		respondent_override: true
	};
}
