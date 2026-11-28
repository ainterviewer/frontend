import '/src/app.css';

import { describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import type { OutgoingHistoryMessage, OutgoingMessage, SecurityIntervention } from '$lib/api';
import SecurityInterventionModal from '$lib/components/interview/SecurityInterventionModal.svelte';
import TimedMessageModal from '$lib/components/interview/TimedMessageModal.svelte';
import WaitingNotice from '$lib/components/interview/WaitingNotice.svelte';

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

describe('ChatClient waiting on the model', () => {
	const question = (content: string) =>
		({
			type: 'message',
			content,
			role: 'assistant',
			message_id: 2,
			can_answer: true
		}) as const;

	test('a model starting up is said at once, with about how long', async () => {
		const { chat } = connectedClient();
		chat.messages.push({ type: 'sent', text: 'My car will not start' });

		await chat.processSingleMessage({ type: 'waiting', reason: 'starting', retry_after: 110 });

		expect(chat.waitingNotice).toBe(
			'Getting the interview ready. This takes about 2 minutes, and it will carry on by itself.'
		);
		// In place of the typing dots, and kept out of the conversation itself.
		expect(chat.showTypingIndicator).toBe(false);
		expect(chat.messages.filter((m) => m.type === 'system')).toEqual([]);
		expect(chat.inputEnabled).toBe(false);
		// The server waits on this socket: nothing reconnects.
		expect(chat.isReconnecting).toBe(false);
		expect(chat.serviceUnavailable).toBe(false);
	});

	test('a later frame replaces the notice, and the next message takes it down', async () => {
		const { chat } = connectedClient();

		await chat.processSingleMessage({ type: 'waiting', reason: 'starting', retry_after: 110 });
		await chat.processSingleMessage({ type: 'waiting', reason: 'starting', retry_after: 10 });
		expect(chat.waitingNotice).toBe(
			'Getting the interview ready. This takes about a minute, and it will carry on by itself.'
		);

		await chat.processSingleMessage(question('How many hours did you work?'));

		expect(chat.waitingNotice).toBeNull();
		expect(chat.messages.at(-1)).toMatchObject({ text: 'How many hours did you work?' });
	});

	test('a busy service is said in the interview language, and still goes', async () => {
		const { chat } = connectedClient('DA');

		await chat.processSingleMessage({ type: 'waiting', reason: 'busy', retry_after: 5 });
		expect(chat.waitingNotice).toBe('Interviewtjenesten er optaget. Prøver igen om et øjeblik…');

		await chat.processSingleMessage(question('Hvor mange timer arbejdede du?'));

		expect(chat.waitingNotice).toBeNull();
	});

	test('when waiting will not help, the interview says it cannot continue', async () => {
		const { chat } = connectedClient();
		await chat.processSingleMessage({ type: 'waiting', reason: 'starting', retry_after: 30 });

		await chat.processSingleMessage({ type: 'data', error: 'InferenceError' });

		expect(chat.serviceUnavailable).toBe(true);
		expect(chat.waitingNotice).toBeNull();
		expect(chat.reconnectEnabled).toBe(false);
	});
});

describe('WaitingNotice', () => {
	test('announces why the reply is late, beside the moving wave', async () => {
		const text = 'Getting the interview ready.';
		await render(WaitingNotice, { text });

		await expect.element(page.getByRole('status')).toHaveTextContent(text);
		// The wave is decoration: hidden from screen readers, read the text.
		const wave = document.querySelector('[role="status"] [aria-hidden="true"] svg');
		expect(wave).not.toBeNull();
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

describe('ChatClient timed messages', () => {
	function timed(as_modal: boolean): OutgoingMessage {
		return {
			type: 'message',
			content: 'Halfway there',
			role: 'assistant',
			message_id: 4,
			can_answer: false,
			as_modal
		};
	}

	test('one shown as a modal stays out of the chat', async () => {
		const { chat } = connectedClient();

		await chat.processSingleMessage(timed(true));

		expect(chat.timedNotices).toEqual(['Halfway there']);
		expect(chat.messages).toEqual([]);
	});

	test('several shown as modals queue up', async () => {
		const { chat } = connectedClient();

		await chat.processSingleMessage(timed(true));
		await chat.processSingleMessage({ ...timed(true), content: 'Almost done' });

		expect(chat.timedNotices).toEqual(['Halfway there', 'Almost done']);
	});

	test('one not shown as a modal joins the chat', async () => {
		const { chat } = connectedClient();

		await chat.processSingleMessage(timed(false));

		expect(chat.timedNotices).toEqual([]);
		expect(chat.messages.map((m) => m.text)).toEqual(['Halfway there']);
	});
});

describe('TimedMessageModal', () => {
	test('shows the message and closes', async () => {
		const onClose = vi.fn();
		await render(TimedMessageModal, { text: 'Halfway there', lang: 'EN', onClose });

		await expect.element(page.getByText('Halfway there')).toBeVisible();
		await page.getByRole('button', { name: 'OK' }).click();
		expect(onClose).toHaveBeenCalledOnce();
	});
});

/** Sockets the client opened, while `WebSocket` is stubbed with `FakeSocket`. */
const sockets: { onopen: () => void }[] = [];
class FakeSocket {
	static OPEN = 1;
	readyState = 1;
	onopen = () => {};
	send = vi.fn();
	close() {}
	constructor() {
		sockets.push(this);
	}
}

describe('ChatClient reconnecting', () => {
	// What the server resends on a reconnect while it waits on the respondent.
	const question: OutgoingMessage = {
		type: 'message',
		content: 'Why?',
		role: 'assistant',
		message_id: 2,
		can_answer: true
	};
	const survey: OutgoingMessage = {
		type: 'message',
		content: 'Rate:',
		role: 'assistant',
		message_id: 4,
		can_answer: true,
		survey_item: { type: 'radio', options: ['Bad', 'Good'] }
	};

	test('input stays closed on reopening, however it was before the drop', async () => {
		sockets.length = 0;
		vi.stubGlobal('WebSocket', FakeSocket);
		try {
			const chat = new ChatClient('project', 'respondent');
			chat.interview_id = 'interview';
			chat.isInitialized = true;
			chat.inputEnabled = true;

			chat.connect();
			sockets[0].onopen();

			// The server opens it again, if it waits on the respondent.
			expect(chat.inputEnabled).toBe(false);
			chat.disconnect();
		} finally {
			vi.unstubAllGlobals();
		}
	});

	test('a question already shown opens input again, and is not drawn twice', async () => {
		const { chat } = connectedClient();
		await chat.processSingleMessage(question);
		chat.inputEnabled = false;

		await chat.processSingleMessage(question);

		expect(chat.messages.map((m) => m.text)).toEqual(['Why?']);
		expect(chat.inputEnabled).toBe(true);
	});

	test('an answer that never arrived is taken back into the field', async () => {
		const { chat } = connectedClient();
		await chat.processSingleMessage(question);
		chat.sendMessage('Because');
		chat.messages.push({ type: 'system', text: 'A note' });

		await chat.processSingleMessage(question);

		expect(chat.messages.map((m) => m.text)).toEqual(['Why?', 'A note']);
		expect(chat.draft).toBe('Because');
		expect(chat.inputEnabled).toBe(true);
		expect(chat.showTypingIndicator).toBe(false);
	});

	test('a question missed in the drop is drawn', async () => {
		const { chat } = connectedClient();
		await chat.processSingleMessage(question);
		chat.sendMessage('Because');

		await chat.processSingleMessage({ ...question, content: 'And then?', message_id: 3 });

		expect(chat.messages.map((m) => m.text)).toEqual(['Why?', 'Because', 'And then?']);
		expect(chat.draft).toBe('');
		expect(chat.inputEnabled).toBe(true);
	});

	test('a survey whose answer never arrived opens again', async () => {
		const { chat } = connectedClient();
		await chat.processSingleMessage(survey);
		chat.sendSurveyResponse('Good', 4);

		await chat.processSingleMessage(survey);

		const items = chat.messages.filter((m) => m.survey_item);
		expect(items).toHaveLength(1);
		expect(items[0].answered).toBeFalsy();
		expect(chat.inputEnabled).toBe(false);
		expect(chat.showTypingIndicator).toBe(false);
	});

	test('an intervention still open is left as it is', async () => {
		const { chat } = connectedClient();
		await chat.processSingleMessage(intervention(true));

		await chat.processSingleMessage(intervention(true));

		expect(chat.securityIntervention?.text).toBe(TEXT);
		expect(chat.messages).toEqual([]);
	});

	test('an intervention whose answer never arrived opens again, without its note', async () => {
		const { chat } = connectedClient();
		await chat.processSingleMessage(intervention(true));
		chat.respondToIntervention('override');

		await chat.processSingleMessage(intervention(true));

		expect(chat.securityIntervention?.text).toBe(TEXT);
		expect(chat.messages).toEqual([]);
	});
});
