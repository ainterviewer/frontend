// Messages from the interview's security check, as a stored transcript shows
// them. Neither is part of the conversation: the intervention was shown to the
// respondent in a modal, and their answer to it given there -- so both are
// drawn as events between the messages rather than as bubbles, and neither can
// be coded.

import type { MessagePublic, SecurityIntervention, SecurityOverride } from '$lib/api';

import type { Message } from './types';

export type SecurityEvent =
	({ kind: 'intervention' } & SecurityIntervention) | { kind: 'answer'; answer: SecurityOverride };

/** The fields that turn a stored security message into an event, or none for
 *  any other message. Spread over the rest of the message's fields. */
export function securityFields(msg: MessagePublic): Partial<Pick<Message, 'type' | 'security'>> {
	if (msg.security_intervention) {
		return { type: 'system', security: { kind: 'intervention', ...msg.security_intervention } };
	}
	if (msg.message_type === 'security_override') {
		return {
			type: 'system',
			security: { kind: 'answer', answer: msg.content as SecurityOverride }
		};
	}
	return {};
}
