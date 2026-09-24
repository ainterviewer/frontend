import { describe, expect, test } from 'vitest';

import type { SecurityDecision, SecurityPolicy } from '$lib/api';

import { newDecision, policyErrors } from './securityPolicy';

function decision(fields: Partial<SecurityDecision> = {}): SecurityDecision {
	return {
		name: 'risk',
		description: 'Is there a risk?',
		threshold: 0.5,
		action: 'end_interview',
		action_text: 'Intervention',
		respondent_override: false,
		...fields
	};
}

const errorsOf = (...decisions: SecurityDecision[]) => policyErrors({ decisions });

describe('policyErrors', () => {
	test('a valid policy has none', () => {
		const errors = errorsOf(decision(), decision({ name: 'other_risk' }));
		expect(errors.policy).toEqual([]);
		expect(errors.decisions.size).toBe(0);
	});

	test('a policy needs a decision', () => {
		expect(errorsOf().policy).toHaveLength(1);
	});

	test.each(['self harm', '1risk', '', 'risk-2'])('rejects the key %j', (name) => {
		expect(errorsOf(decision({ name })).decisions.get(0)).toHaveLength(1);
	});

	test('only the repeated key is flagged', () => {
		const errors = errorsOf(decision(), decision());
		expect(errors.decisions.has(0)).toBe(false);
		expect(errors.decisions.get(1)?.[0]).toContain('already uses');
	});

	test.each([
		['empty question', { description: '  ' }],
		['empty message', { action_text: '' }],
		['threshold above 1', { threshold: 1.5 }],
		['threshold below 0', { threshold: -0.1 }],
		['missing threshold', { threshold: NaN }]
	])('rejects an %s', (_, fields) => {
		expect(errorsOf(decision(fields)).decisions.get(0)).toHaveLength(1);
	});
});

describe('newDecision', () => {
	test('gets a key no other decision has', () => {
		const policy: SecurityPolicy = {
			decisions: [decision({ name: 'decision_2' }), decision({ name: 'decision_3' })]
		};

		const added = newDecision(policy, 'Intervention');

		expect(added.name).toBe('decision_4');
		// Only the question is left to fill in.
		expect(policyErrors({ decisions: [...policy.decisions, added] }).decisions.get(2)).toEqual([
			'The question for the model is empty.'
		]);
	});
});
