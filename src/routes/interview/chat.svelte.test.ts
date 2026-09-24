import '/src/app.css';

import { describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import type { OutgoingHistoryMessage, OutgoingMessage, SecurityIntervention } from '$lib/api';
import SecurityInterventionModal from '$lib/components/interview/SecurityInterventionModal.svelte';

import { ChatClient } from './chat.svelte';

const TEXT = 'Our automated safety system has triggered an intervention.';

function intervention(
	respondent_override: boolean,
	action: SecurityIntervention['action'] = 'skip_probes'
): OutgoingMessage {
	return {
		type: 'message',
		content: TEXT,
		role: 'assistant',
		message_id: 3,
		can_answer: false,
		security_intervention: { action, respondent_override }
	};
}

/** A client on an open socket, recording what it sends. */
function connectedClient() {
	const chat = new ChatClient('project');
	const send = vi.fn();
	chat.ws = { readyState: WebSocket.OPEN, send } as unknown as WebSocket;
	const sent = () => send.mock.calls.map(([frame]) => JSON.parse(frame));
	return { chat, sent };
}

describe('ChatClient security interventions', () => {
	test('an intervention opens the modal instead of joining the chat', async () => {
		const { chat } = connectedClient();

		await chat.processSingleMessage(intervention(true));

		expect(chat.securityIntervention).toEqual({
			action: 'skip_probes',
			respondent_override: true,
			text: TEXT
		});
		expect(chat.messages).toEqual([]);
		expect(chat.inputEnabled).toBe(false);
	});

	test('answering sends the choice and leaves a note in the chat', async () => {
		const { chat, sent } = connectedClient();
		await chat.processSingleMessage(intervention(true));

		chat.respondToIntervention('override');

		expect(sent()).toEqual([{ type: 'message', content: 'override' }]);
		expect(chat.securityIntervention).toBeNull();
		expect(chat.messages).toEqual([{ type: 'system', text: TEXT }]);
		// The server speaks next, whichever way it was answered.
		expect(chat.showTypingIndicator).toBe(true);
	});

	test('an intervention without override is only closed', async () => {
		const { chat, sent } = connectedClient();
		await chat.processSingleMessage(intervention(false, 'end_interview'));

		// The server goes on without waiting for the respondent.
		expect(chat.forceTypingIndicator).toBe(true);

		chat.dismissIntervention();

		expect(sent()).toEqual([]);
		expect(chat.securityIntervention).toBeNull();
		expect(chat.messages).toEqual([{ type: 'system', text: TEXT }]);
	});

	test('a replayed intervention is a note, not a modal', async () => {
		const { chat } = connectedClient();
		const replayed: OutgoingHistoryMessage = {
			type: 'history',
			content: TEXT,
			role: 'assistant',
			message_id: 3,
			security_intervention: { action: 'skip_probes', respondent_override: true }
		};

		await chat.processSingleMessage(replayed);

		expect(chat.securityIntervention).toBeNull();
		expect(chat.messages).toEqual([{ type: 'system', text: TEXT }]);
	});
});

describe('SecurityInterventionModal', () => {
	test('offers both answers when the respondent may override', async () => {
		const onRespond = vi.fn();
		render(SecurityInterventionModal, {
			intervention: { action: 'end_interview', respondent_override: true, text: TEXT },
			lang: 'EN',
			onRespond,
			onDismiss: () => {}
		});

		await expect.element(page.getByText(TEXT)).toBeVisible();
		await page.getByRole('button', { name: 'Continue the interview' }).click();
		await page.getByRole('button', { name: 'End the interview' }).click();

		expect(onRespond.mock.calls).toEqual([['override'], ['accept']]);
	});

	test('can only be acknowledged otherwise', async () => {
		const onDismiss = vi.fn();
		render(SecurityInterventionModal, {
			intervention: { action: 'end_interview', respondent_override: false, text: TEXT },
			lang: 'DA',
			onRespond: () => {},
			onDismiss
		});

		await expect.element(page.getByRole('button')).toHaveTextContent('OK');
		await page.getByRole('button', { name: 'OK' }).click();

		expect(onDismiss).toHaveBeenCalledOnce();
	});
});
