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
function connectedClient(lang?: string) {
	const chat = new ChatClient('project', 'respondent', lang);
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
		await render(SecurityInterventionModal, {
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
		await render(SecurityInterventionModal, {
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

describe('ChatClient opening message', () => {
	test('an interview may open on a question', async () => {
		const { chat } = connectedClient();

		await chat.processSingleMessage({
			type: 'message',
			content: 'Anything to add?',
			role: 'assistant',
			message_id: 1,
			can_answer: true
		});

		expect(chat.inputEnabled).toBe(true);
		expect(chat.showTypingIndicator).toBe(false);
	});

	test('an introduction waits for the first question', async () => {
		const { chat } = connectedClient();

		await chat.processSingleMessage({
			type: 'message',
			content: 'Welcome!',
			role: 'assistant',
			message_id: 1,
			can_answer: false
		});

		expect(chat.inputEnabled).toBe(false);
		expect(chat.showTypingIndicator).toBe(true);
	});
});

describe('ChatClient transient failures', () => {
	const BUSY = 'The interview service is busy. Trying again in a moment…';
	const busyNotices = (chat: ChatClient) =>
		chat.messages.filter((m) => m.type === 'system' && m.text === BUSY);

	test('the busy notice goes once the interview resumes', async () => {
		vi.useFakeTimers();
		try {
			const { chat } = connectedClient();

			await chat.processSingleMessage({ type: 'data', error: 'InstanceInitializing' });
			expect(busyNotices(chat)).toHaveLength(1);

			// Another transient failure on the retry keeps it, once.
			await chat.processSingleMessage({ type: 'data', error: 'InstanceInitializing' });
			expect(busyNotices(chat)).toHaveLength(1);

			await chat.processSingleMessage({
				type: 'message',
				content: 'How many hours did you work?',
				role: 'assistant',
				message_id: 2,
				can_answer: true
			});

			expect(busyNotices(chat)).toEqual([]);
			expect(chat.messages.at(-1)).toMatchObject({ text: 'How many hours did you work?' });
		} finally {
			vi.useRealTimers();
		}
	});

	test('the busy notice is in the interview language, and still goes', async () => {
		vi.useFakeTimers();
		try {
			const { chat } = connectedClient('DA');
			const notices = () => chat.messages.filter((m) => m.type === 'system');

			await chat.processSingleMessage({ type: 'data', error: 'InstanceInitializing' });
			expect(notices()).toEqual([
				{ type: 'system', text: 'Interviewtjenesten er optaget. Prøver igen om et øjeblik…' }
			]);

			await chat.processSingleMessage({
				type: 'message',
				content: 'Hvor mange timer arbejdede du?',
				role: 'assistant',
				message_id: 2,
				can_answer: true
			});

			expect(notices()).toEqual([]);
		} finally {
			vi.useRealTimers();
		}
	});
});

describe('ChatClient replayed surveys', () => {
	const grid: NonNullable<OutgoingHistoryMessage['survey_item']> = {
		type: 'likert_grid',
		options: ['Bad', 'Good'],
		rows: [{ id: '00000000-0000-0000-0000-000000000001', text: 'Food' }]
	};
	const answer = '{"00000000-0000-0000-0000-000000000001": "Good"}';

	function history(
		role: 'assistant' | 'user',
		content: string,
		message_id: number,
		survey_item?: OutgoingHistoryMessage['survey_item']
	): OutgoingHistoryMessage {
		return { type: 'history', role, content, message_id, survey_item };
	}

	test('an answered survey comes back as the item with its answer', async () => {
		const { chat } = connectedClient();

		await chat.processSingleMessage(history('assistant', 'Rate:', 4, grid));
		await chat.processSingleMessage(history('user', answer, 5));

		expect(chat.messages).toEqual([
			{ type: 'received', text: 'Rate:', message_id: 4, feedback: undefined },
			{ type: 'sent', survey_item: grid, message_id: 4, answered: true, answer }
		]);
	});

	test('a skipped survey comes back faded, followed by the skip', async () => {
		const { chat } = connectedClient();

		await chat.processSingleMessage(history('assistant', 'Rate:', 4, grid));
		await chat.processSingleMessage(history('user', '<|skipquestion|>', 5));

		expect(chat.messages.slice(1)).toEqual([
			{ type: 'sent', survey_item: grid, message_id: 4, answered: true, skipped: true },
			{ type: 'sent', text: '<|skipquestion|>', message_id: 5 }
		]);
	});

	test('only the answer to the survey question is drawn as one', async () => {
		const { chat } = connectedClient();

		await chat.processSingleMessage(history('assistant', 'Rate:', 4, grid));
		await chat.processSingleMessage(history('user', answer, 5));
		await chat.processSingleMessage(history('assistant', 'Why?', 6));
		await chat.processSingleMessage(history('user', 'Tasty', 7));

		expect(chat.messages.at(-1)).toEqual({ type: 'sent', text: 'Tasty', message_id: 7 });
	});
});
