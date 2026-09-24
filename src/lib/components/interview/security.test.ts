import { describe, expect, test } from 'vitest';

import type { MessagePublic } from '$lib/api';

import { securityFields } from './security';

function stored(fields: Partial<MessagePublic>): MessagePublic {
	return {
		id: 'id',
		message_id: 1,
		content: 'content',
		role: 'assistant',
		interview_id: 'interview',
		project_id: 'project',
		created_at: '2026-09-24T00:00:00',
		...fields
	} as MessagePublic;
}

describe('securityFields', () => {
	test('an intervention becomes an event', () => {
		const intervention = { action: 'skip_probes', respondent_override: true } as const;

		expect(securityFields(stored({ security_intervention: intervention }))).toEqual({
			type: 'system',
			security: { kind: 'intervention', ...intervention }
		});
	});

	test("the respondent's answer becomes an event", () => {
		const answer = stored({
			role: 'user',
			content: 'override',
			message_type: 'security_override'
		});

		expect(securityFields(answer)).toEqual({
			type: 'system',
			security: { kind: 'answer', answer: 'override' }
		});
	});

	test('any other message is left alone', () => {
		expect(securityFields(stored({ role: 'user', message_type: 'text' }))).toEqual({});
	});
});
